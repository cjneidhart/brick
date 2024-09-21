Config.preProcessText = function (passage) {
  return `<h2>${passage.name}</h2>\n${passage.content}`;
};
