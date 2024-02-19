# vscode-forester

Some basic VSCode support for [Forester](https://www.jonmsterling.com/jms-005P.xml), a tool for tending forests of evergreen notes.

![A demonstration of the plugin's completion ability.](demo/image.png)

## Features

- [ ] Language highlight
  - [X] Basic structure, comments
    - [ ] Escapes are not quite right yet, though I'm not sure forester is doing it right either
  - [X] Built-in commands
  - [X] Mark-ups
  - [X] Links
  - [ ] Handle verbatim correctly (help I'm drowning in regex)
  - [X] ~~Embedded formula highlight~~ (pretending it's plain forester syntax is good enough)
- [ ] Convenience features
  - [X] Tree ID completion. **You can type in a part of the title to filter for trees. Press tabs to insert the ID (which will replace the title you entered)**
  - [ ] Advanced language features (this is not doable without a forester LSP)
  - [ ] Formula preview (hard without forester LSP, since macros are evaluated by forester)
  - [ ] Shift-click to jump to file (how do we locate anything? we need more stuff for `forester query`)
  - [ ] Build on save
    - [ ] error reporting (maybe we ask forester to not include those fancy stuff in error reports)
- [ ] GUI for common actions such as tree creation
- [X] ~~Integrate with the edit button?~~ (it's doing fine on its own)

## Requirements

You need `forester` installed, see [here](https://www.jonmsterling.com/jms-005P.xml) for the instructions. Configure the paths in the settings.

## Extension Settings

- Use the `forester.command` setting to configure what command the plugin should run to query information from your forest. Usually it should be some invocation of of `forester query all`.

## Known Issues
