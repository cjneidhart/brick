import { slugify } from "./util";

export class Passage {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly tags: readonly string[];
  #element: Element;

  constructor(element: Element) {
    const id = element.getAttribute("pid");
    if (!id) {
      throw new Error("Passage has no pid: " + element.outerHTML);
    }
    const name = element.getAttribute("name");
    if (!name) {
      throw new Error(`Passage ${id} has no name`);
    }
    this.id = id;
    this.name = name;
    this.slug = slugify(name);
    this.tags =
      element
        .getAttribute("tags")
        ?.split(" ")
        .filter((x) => x) || [];
    this.#element = element;
  }

  get content() {
    return this.#element.textContent || "";
  }
}

const BANNED_NAMES = [
  "PassageDone",
  "PassageFooter",
  "PassageHeader",
  "PassageReady",
  "StoryAuthor",
  "StoryBanner",
  "StoryCaption",
  "StoryDisplayTitle",
  "StoryInit",
  "StoryInterface",
  "StoryMenu",
  "StorySettings",
  "StorySubtitle",
  "StoryTitle",
];

const BANNED_TAGS = [
  "init",
  "script",
  "stylesheet",
  "Twine.audio",
  "Twine.image",
  "Twine.video",
  "Twine.vtt",
  "widget",
  "header",
  "footer",
  "startup",
  "debug-header",
  "debug-footer",
  "debug-startup",
  "nobr",
];

function checkBannedNames(name: string) {
  if (BANNED_NAMES.includes(name)) {
    throw new Error(`The passage name "${name}" is not allowed`);
  }
}

function checkBannedTags(tags: readonly string[], passageName: string) {
  for (const tag of tags) {
    if (BANNED_TAGS.includes(tag)) {
      throw new Error(`The tag '${tag}' on the passage "${passageName} is not allowed`);
    }
  }
}

const byId = new Map<string, Passage>();
const byName = new Map<string, Passage>();
let startPassage: Passage;

export function init(storyData: Element) {
  const passageElements = storyData.getElementsByTagName("tw-passagedata");

  for (const elt of passageElements) {
    const passage = new Passage(elt);
    const { id, name } = passage;

    checkBannedNames(passage.name);
    if (passage.name.startsWith("::")) {
      console.warn(
        `Found a passage named "${name}". Although starting a passage name with "::" is allowed, this is likely a mistake.`,
      );
    }

    checkBannedTags(passage.tags, name);

    if (byId.has(id)) {
      throw new Error(`Duplicate passage id ${id}`);
    }
    if (byName.has(name)) {
      throw new Error(`Duplicate passage name ${name}`);
    }

    if (!passage.content.trim()) {
      console.warn(`Passage ${name} has no text.`);
    }

    byId.set(id, passage);
    byName.set(name, passage);
  }

  const startPid = storyData.getAttribute("startnode");
  if (startPid) {
    const maybeStart = byId.get(startPid);
    if (!maybeStart) {
      throw new Error(`Could not determine starting passage; no passage with ${startPid}`);
    }
    startPassage = maybeStart;
  } else {
    const maybeStart = byName.get("Start");
    if (!maybeStart) {
      throw new Error(`Could not find a passage named "Start"`);
    }
    startPassage = maybeStart;
  }
}

export function filter(predicate: (passage: Passage) => boolean): Passage[] {
  const result = [];
  for (const passage of byName.values()) {
    if (predicate(passage)) {
      result.push(passage);
    }
  }
  return result;
}

export function find(predicate: (passage: Passage) => boolean): Passage | undefined {
  for (const passage of byName.values()) {
    if (predicate(passage)) {
      return passage;
    }
  }
  return undefined;
}

export function get(name: string): Passage | undefined {
  return byName.get(name);
}

export function start(): Passage {
  return startPassage;
}

export function withTag(tag: string): Passage[] {
  return filter((psg) => psg.tags.includes(tag));
}
