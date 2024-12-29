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
    this.name = name.trim();
    this.slug = slugify(name);
    this.tags =
      element
        .getAttribute("tags")
        ?.split(" ")
        .filter((tag) => tag.length >= 0)
        .sort() || [];
    this.#element = element;
  }

  get content() {
    return this.#element.textContent;
  }

  toString() {
    return `Passage "${this.name}"`;
  }
}

// TODO: provide more detailed warnings for some of these.
const WARN_PASSAGE_NAMES = ["PassageDone", "PassageFooter", "PassageHeader", "PassageReady"];
const ALLOWED_SPECIAL_NAMES = ["StoryFooter", "StoryHeader", "StoryInit", "StoryInterface"];
const WARN_TAGS = new Set([
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
]);

function checkBannedNames(name: string) {
  if (WARN_PASSAGE_NAMES.includes(name)) {
    console.warn(
      `The passage name "${name}" has no special meaning to Brick. Use "StoryHeader" or "StoryFooter" instead.`,
    );
  } else if (name === "StoryTitle" || name === "StoryData") {
    console.warn(
      `The passage "${name}" should have been removed by your compiler. This is likely an error.`,
    );
  } else if (name.startsWith("Story") && !ALLOWED_SPECIAL_NAMES.includes(name)) {
    throw new Error(`The passage name "${name}" is not allowed.`);
  }
}

function checkBannedTags(tags: readonly string[], passageName: string) {
  for (const tag of tags) {
    if (WARN_TAGS.has(tag)) {
      console.warn(`The tag "${tag}" on passage "${passageName}" has no special meaning in Brick.`);
      WARN_TAGS.delete(tag);
    } else if (tag.startsWith("brick")) {
      throw new Error(`The tag "${tag}" on passage "${passageName}" is not allowed.`)
    }
  }
}

const byId = new Map<string, Passage>();
const byName = new Map<string, Passage>();
let startPassage: Passage;

/** @param storyData The `<tw-storydata>` element */
export function init(storyData: Element) {
  const passageElements = Array.from(storyData.getElementsByTagName("tw-passagedata"));
  const passageArray = passageElements.map((elt) => new Passage(elt));
  passageArray.sort((a, b) => {
    if (a.name === b.name) {
      return 0;
    } else {
      return a.name < b.name ? -1 : 1;
    }
  });

  for (const passage of passageArray) {
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
      throw new Error(`Could not determine starting passage; no passage with ID "${startPid}"`);
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

/** @returns all passages for which `predicate` returned true */
export function filter(predicate: (passage: Passage) => boolean): Passage[] {
  const result = [];
  for (const passage of byName.values()) {
    if (predicate(passage)) {
      result.push(passage);
    }
  }
  return result;
}

/** @returns a passage for which `predicate` returned true */
export function find(predicate: (passage: Passage) => boolean): Passage | undefined {
  for (const passage of byName.values()) {
    if (predicate(passage)) {
      return passage;
    }
  }
  return undefined;
}

/** @returns the passage with the given name */
export function get(name: string): Passage | undefined {
  return byName.get(name.trim());
}

/** @returns the passage that should be used as the story start */
export function start(): Passage {
  return startPassage;
}

/** @returns all passages with the given tag */
export function withTag(tag: string): Passage[] {
  return filter((psg) => psg.tags.includes(tag));
}
