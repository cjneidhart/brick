import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiDom from "chai-dom";

chai.use(chaiDom);
chai.use(chaiAsPromised);
const { expect } = chai;

function createPassage(name: string, tags = "", body?: string): HTMLElement {
  const passage = document.createElement("tw-passagedata");
  passage.setAttribute("name", name);
  passage.setAttribute("tags", tags);
  passage.append(body || `Test passage "${name}". Please ignore.`);
  return passage;
}

function getElementById(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`No element with id "${id}" found`);
  }
  return element;
}

function getActivePassage(): HTMLElement {
  const element = document.querySelector("#brick-main .brick-active-passage");
  if (!element) {
    throw new Error("Couldn't locate active passage");
  }
  element.normalize();

  expect(element.tagName).to.equal("ARTICLE");
  expect(element).to.have.class("brick-passage");
  expect(element).to.have.class("brick-active-passage");

  return element as HTMLElement;
}

const { brickInit, brickFinish } = window;

mocha.setup({
  slow: 100,
  timeout: 5000,
  ui: "bdd",
});

const mochaStyle = getElementById("mocha-style");
const mochaOutput = getElementById("mocha");

let storyData: HTMLElement;
let storyStyle: HTMLStyleElement;
let storyScript: HTMLScriptElement;
let startPassage: HTMLElement;

beforeEach(function () {
  document.head.innerHTML = "";
  document.body.innerHTML = "";

  document.head.innerHTML = `
    <title>Brick Test Suite</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  `;

  document.body.innerHTML = `
    <div id="brick-viewport">
      <aside id="ui-bar">
        <div id="brick-history-controls">
          <button id="brick-history-backward" class="brick-ui-btn" type="button">&#x2190;</button>
          <button id="brick-history-forward" class="brick-ui-btn" type="button">&#x2192;</button>
        </div>
        <h1 id="story-title">Brick Test Suite</h1>
        <ul id="brick-menu-core">
          <li><button id="brick-saves" class="brick-ui-btn" type="button">SAVES</button></li>
          <li><button id="brick-restart" class="brick-ui-btn" type="button">RESTART</button></li>
        </ul>
      </aside>

      <main id="brick-main">
        <noscript>JavaScript must be enabled to play this story.</noscript>
      </main>
    </div>
    <dialog id="brick-dialog"></dialog>
  `;

  storyData = document.createElement("tw-storydata");
  storyData.setAttribute("name", "Brick Test Story");
  storyData.setAttribute("ifid", "IFID-BUT-NOT-UUID");
  storyData.setAttribute("startnode", "27");

  storyStyle = document.createElement("style");
  storyData.append(storyStyle);

  storyScript = document.createElement("script");
  storyData.append(storyScript);

  startPassage = document.createElement("tw-passagedata");
  startPassage.setAttribute("name", "test start");
  startPassage.setAttribute("pid", "27");
  storyData.append(startPassage);

  document.body.prepend(storyData);
});

afterEach(async function () {
  brickFinish();
  for (const db of await indexedDB.databases()) {
    await new Promise<void>((resolve, reject) => {
      if (!db.name) {
        resolve();
        return;
      }
      const request = indexedDB.deleteDatabase(db.name);
      request.onsuccess = () => resolve();
      request.onblocked = reject;
      request.onerror = reject;
      request.onupgradeneeded = reject;
    });
  }
});

describe("Malformed Story Data", function () {
  it("throws on missing <tw-storydata>", function () {
    storyData.remove();
    return expect(brickInit()).to.be.rejected;
  });

  it("throws on missing name", function () {
    storyData.removeAttribute("name");
    return expect(brickInit()).to.be.rejectedWith("title");
  });

  it("throws on missing startnode property", function () {
    storyData.removeAttribute("startnode");
    return expect(brickInit()).to.be.rejectedWith(/start/i);
  });

  it("throws on duplicate passage name", function () {
    const oriole = createPassage("oriole");
    storyData.append(oriole, oriole.cloneNode());
    return expect(brickInit()).to.be.rejectedWith(/duplicate/i);
  });

  it("throws on passage name beginning with 'Story'", function () {
    storyData.append(createPassage("StoryBlueJay", ""));
    return expect(brickInit()).to.be.rejectedWith(/Story/);
  });
});

describe("Basic Functionality", function () {
  it("renders a plain passage", async function () {
    startPassage.textContent = `Hello World!`;
    await brickInit();
    const active = getActivePassage();
    expect(active).to.have.class("psg-test-start");
    expect(active).to.have.length(0);
    expect(active).to.have.text("Hello World!");
  });

  it("leaves single newlines in the HTML", async function () {
    startPassage.textContent = "Hello\nWorld!";
    await brickInit();
    const active = getActivePassage();
    expect(active).to.have.length(0);
    expect(active).to.have.text("Hello\nWorld!");
  });

  it("replaces adjacent newlines with <br><br>", async function () {
    startPassage.textContent = "Hello\n\nWorld!";
    await brickInit();
    const active = getActivePassage();
    expect(active).to.have.length(2);
    expect(active.childNodes[0]).to.be.instanceOf(Text);
    expect(active.childNodes[0]).to.have.text("Hello");
    expect(active.childNodes[1]).to.be.instanceOf(HTMLBRElement);
    expect(active.childNodes[2]).to.be.instanceOf(HTMLBRElement);
    expect(active.childNodes[3]).to.be.instanceOf(Text);
    expect(active.childNodes[3]).to.have.text("World!");
  });
});

mocha.run(function () {
  document.head.innerHTML = `
    <title>Brick Test Suite</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
  `;
  document.head.append(mochaStyle);

  document.body.innerHTML = "";
  document.body.append(mochaOutput);
});
