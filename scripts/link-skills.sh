#!/usr/bin/env bash
set -euo pipefail

# Links every skill in this repo into the local skill directories:
#   ~/.claude/skills  Claude Code
#   ~/.agents/skills  Codex and other Agent Skills harnesses
# Each entry is a symlink into this repo, so `git pull` keeps them current.
# This is for working on Rstack itself. Everyone else installs the plugin.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

# Git Bash copies instead of linking unless told to make native symlinks.
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) export MSYS=winsymlinks:nativestrict ;;
esac

mapfile -d '' skill_files < <(find "$REPO/skills" -name SKILL.md -not -path '*/node_modules/*' -print0)

for dest in "${DESTS[@]}"; do
  # A destination that is itself a link into this repo would get the links
  # written back into skills/.
  if [ -L "$dest" ]; then
    case "$(readlink -f "$dest")" in
      "$REPO" | "$REPO"/*)
        echo "error: $dest is a symlink into this repo. Remove it and re-run." >&2
        exit 1
        ;;
    esac
  fi

  mkdir -p "$dest"

  for skill_md in "${skill_files[@]}"; do
    src="$(dirname "$skill_md")"
    name="$(basename "$src")"
    target="$dest/$name"

    if [ -e "$target" ] && [ ! -L "$target" ]; then
      echo "skipped $name: $target is a real folder. Move it aside to link Rstack's copy." >&2
      continue
    fi

    ln -sfn "$src" "$target"
    echo "linked $name ($dest)"
  done
done
