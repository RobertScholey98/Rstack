// Globs as .gitignore reads them: `*` stays inside a folder, `**` crosses
// folders, and a glob with no slash matches a file name at any depth.
export function globToRegExp(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      i++;
      if (glob[i + 1] === "/") {
        i++;
        source += "(?:.*/)?";
      } else {
        source += ".*";
      }
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

export function matchesAny(path, globs = []) {
  const name = path.split("/").pop();
  return globs.some((glob) => globToRegExp(glob).test(glob.includes("/") ? path : name));
}
