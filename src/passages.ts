import { slugify } from "./util";

export class Passage {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly content: string;
  readonly tags: readonly string[];

  constructor(id: string, name: string, content: string, tags: string[]) {
    this.id = id;
    this.name = name;
    this.slug = slugify(name);
    this.content = content;
    this.tags = Object.freeze(tags);
    Object.freeze(this);
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
    throw new Error(
      `The passage name "${name}" is not allowed`,
    );
  }
}

function checkBannedTags(tags: string[], passageName: string) {
  for (const tag of tags) {
    if (BANNED_TAGS.includes(tag)) {
      throw new Error(
        `The tag '${tag}' on the passage "${passageName} is not allowed`,
      );
    }
  }
}

export class PassageIndex {
  #byId: Map<string, Passage>;
  #byName: Map<string, Passage>;

  constructor(storyData: Element) {
    const passageElements = storyData.getElementsByTagName("tw-passagedata");
    this.#byId = new Map();
    this.#byName = new Map();

    for (const elt of passageElements) {
      const id = elt.getAttribute('pid');
      if (!id) {
        throw new Error('Passage has no pid: ' + elt.outerHTML);
      }
      const name = elt.getAttribute("name");
      if (!name) {
        throw new Error(`Passage "${id}" has no name`);
      }
      checkBannedNames(name);
      const tags = elt.getAttribute("tags")?.split(" ").filter((x) => x) || [];
      checkBannedTags(tags, name);
      const passage = new Passage(id, name, elt.innerHTML, tags);
      if (this.#byId.has(id)) {
        throw new Error(`Duplicate passage id ${id}`);
      }
      if (this.#byName.has(name)) {
        throw new Error(`Duplicate passage name ${name}`);
      }
      this.#byId.set(id, passage);
      this.#byName.set(name, passage);
    }
  }

  filter(predicate: (passage: Passage) => boolean): Passage[] {
    const result = [];
    for (const passage of this.#byName.values()) {
      if (predicate(passage)) {
        result.push(passage);
      }
    }
    return result;
  }

  find(predicate: (passage: Passage) => boolean): Passage | undefined {
    for (const passage of this.#byName.values()) {
      if (predicate(passage)) {
        return passage;
      }
    }
    return undefined;
  }

  get(name: string): Passage | undefined {
    return this.#byName.get(name);
  }
}
