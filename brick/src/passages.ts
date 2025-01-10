import { slugify } from "./util";

export class Passage {
  readonly name: string;
  readonly slug: string;
  readonly tags: readonly string[];
  #element: Element;

  constructor(element: Element) {
    const name = element.getAttribute("name");
    if (!name) {
      throw new Error(`Passage has no name`);
    }
    this.name = name.trim();
    this.slug = slugify(name);
    this.tags = Object.freeze(
      element
        .getAttribute("tags")
        ?.split(" ")
        .filter((tag) => tag.length >= 0)
        .sort() || [],
    );
    this.#element = element;
    Object.freeze(this);
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
const WARN_TAGS = new Set(["init", "debug-footer", "debug-startup", "nobr"]);

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
      throw new Error(`The tag "${tag}" on passage "${passageName}" is not allowed.`);
    }
  }
}

const byName = new Map<string, Passage>();
let startPassage: Passage;

/** @param storyData The `<tw-storydata>` element */
export function init(storyData: Element) {
  const startPid = storyData.getAttribute("startnode");
  const passageElements = Array.from(storyData.getElementsByTagName("tw-passagedata"));
  const passageArray = passageElements.map((elt) => {
    const passage = new Passage(elt);
    if (elt.getAttribute("pid") === startPid) {
      startPassage = passage;
    }
    return passage;
  });
  passageArray.sort((a, b) => {
    if (a.name === b.name) {
      return 0;
    } else {
      return a.name < b.name ? -1 : 1;
    }
  });

  for (const passage of passageArray) {
    const { name } = passage;

    checkBannedNames(name);
    if (name.startsWith("::")) {
      console.warn(
        `Found a passage named "${name}". Although starting a passage name with "::" is allowed, this is likely a mistake.`,
      );
    }

    checkBannedTags(passage.tags, name);

    if (byName.has(name)) {
      throw new Error(`Duplicate passage name ${name}`);
    }

    if (!passage.content.trim()) {
      console.warn(`Passage ${name} has no text.`);
    }

    byName.set(name, passage);
  }

  if (!startPassage) {
    // Twine and Tweego always set the `startnode` attribute, but we may as well include this just in case
    const maybeStart = byName.get("Start");
    if (!maybeStart) {
      throw new Error(`Could not find a passage named "Start"`);
    }
    startPassage = maybeStart;
  }
}

/** @returns all passages for which `predicate` returned truthy */
export function filter(predicate: (passage: Passage) => unknown): Passage[] {
  const result = [];
  for (const passage of byName.values()) {
    if (predicate(passage)) {
      result.push(passage);
    }
  }
  return result;
}

/** @returns a passage for which `predicate` returned truthy */
export function find(predicate: (passage: Passage) => unknown): Passage | undefined {
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
