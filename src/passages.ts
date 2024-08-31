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
    throw new Error(`The passage name "${name}" is not allowed`);
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

const byId = new Map<string, Passage>();
const byName = new Map<string, Passage>();

export function init(storyData: Element) {
  const passageElements = storyData.getElementsByTagName("tw-passagedata");

  for (const elt of passageElements) {
    const id = elt.getAttribute("pid");
    if (!id) {
      throw new Error("Passage has no pid: " + elt.outerHTML);
    }
    const name = elt.getAttribute("name");
    if (!name) {
      throw new Error(`Passage "${id}" has no name`);
    }
    checkBannedNames(name);
    const tags =
      elt
        .getAttribute("tags")
        ?.split(" ")
        .filter((x) => x) || [];
    checkBannedTags(tags, name);
    const passage = new Passage(id, name, elt.textContent || "", tags);
    if (byId.has(id)) {
      throw new Error(`Duplicate passage id ${id}`);
    }
    if (byName.has(name)) {
      throw new Error(`Duplicate passage name ${name}`);
    }
    byId.set(id, passage);
    byName.set(name, passage);
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

export function find(
  predicate: (passage: Passage) => boolean,
): Passage | undefined {
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

export function withTag(tag: string): Passage[] {
  return filter((psg) => psg.tags.includes(tag));
}
