# Quick Plugin Switcher (QPS)

This plugin simplifies the process of managing your plugins (demos at the end of this page)  

## Introduction:

This plugin is done around two windows:

- the main window give access to all installed plugins with many options 
- and the second window is an improved version of community plugins view with many options 

installed plugins
![windows](img/main_windows.jpg)
community plugins
![windows](img/second_window.png)

there are buttons, context menus, dropdown menus, search menus, and you can double click on some elements 

## Mainly, you can:

- quickly toggle enable/disable on plugins
- use groups for many operations
- add a delay at start
- enable/disable platform dependent mobile/desktop
- get quick accesses (github repo, plugin folder...)
- apply some filters search, hide groups...
- take some notes on community plugins
- tools to install plugins between vaults
- switch a plugin via command

## New: 

- see downloads stats for each community plugin using (s) or in the context menu on mobile.  Using this site [obsidian stats](https://www.moritzjung.dev/obsidian-stats)

![addcmd](gif/show_stats.gif)

- option in setting to keep last value in dropdown menus (true by default)
- switch a plugin via command. 

![addcmd](img/add_command.png)
then in command palette  
![cmdinpalette](img/command_in_palette.png)

- add notes to community plugins 

![platformDep](img/note_button.png)
![platformDep](img/edit_note.png)  

- option to make a plugin platform dependant

![platformDep](img/platformDep.jpg)
- plugin updates
- community plugins have been added and a lot of things fixed or improved

## Features

### general
- access QPS from ribbon bar or command 

### filters

you have now an option in plugin settings to keep previous filter value when re opening a window

- first window

![filters](img/filters.jpeg)  
filter By group
![filters](img/show_by_group.jpg)
filter by Most Switched filter (most switched plugins)
![most_switched](img/most-switched.jpg)

- second window

![most_switched](img/comfilters.jpg)


## search bar

- first window

![search](img/searchbar.jpg)
- second window

![search](img/secondbar.png)
![button](img/comotherbutton.png)
this button to do some additional things...

## floating groups bar
![search](img/groupbar.png)


- you can **double click the name** to rename a group
- you can **double click the icon** (before name) to add a delay to a group (plugins in group delayed at start)
- you can hide a group, shortcut h, or in context menu
- you can open a **context menu** on group name

![search](img/groupcontext.png)
in community plugin the behaviour is the same with some different options

![search](img/commgroupcontext.png)

## shortcut bar

In the first window
![search](img/shortcuts.png)
Shortcut that you can press over a plugin name:  
here we have 4 groups so we can press 1,2,3,4 over a plugin to add a group.  
0/del/suppr to delete group(s).   
f to open the plugin folder  
g to open the github repo
ctrl to open short plugin description  
s plugin settings  
h plugin hotkeys
double click to add a delay on start to a plugin.  

in commmunity plugins
![search](img/comshortcuts.png)
n to add a note of description. useful to remember things  
ctrl/dbl click to open the github readme.

## plugin items

First window
![search](img/pluginitems.png)
- we can see 4 groups added to the same plugin. 6 groups max are possible
- a delay at start of 2 seconds. double click on the plugin name. and same to disable the delay
- the green dashed line is on a plugin only enable on mobile platform. Useful when you share a vault on the cloud between different devices.
- desktop only plugins are marked with a ᴰ
![show_hotkey](img/desktopOnly.jpg)
-context menu
![contextmenu](img/contextmenu.png)


Second window
![pluginitem](img/compluginitems.png)
- the note button allow to create a note (then the button is green)
![notes](img/notemodal.png)
H1 are used to create each note in a same markdown file in your vault. You can choose the folder where this file will be in settings.
To delete a note, delete all its content.
- double clicking or pressing ctrl over a block will open the readme
![readme](img/readme.png)
- context menu with install uninstall enable



## videos

-6- [youtube](https://youtu.be/-sPDQBTuEkc?si=uUKovOgOgnkdefyI) main presentation

-5- add command to plugin to quickly switch it
![add_command_to_plugin](gif/add_command_to_plugin.gif)

-4- shortcuts helper
![shortcuts helper](gif/shortcuts_helper.gif)

-3- delay at start (feature request, inspired by "plugin groups")
![demo_delay](gif/demo_delay.gif)
update info will show only once

-2- groups
![Newvid](gif/multi-group-rename.gif)

-1- first demo
![vid](gif/demo.gif)  

## Development (Add this to your README)

### Optional (SASS):
If you add a `styles.scss` file to the `src` folder, it will automatically be converted to CSS when you run commands such as `npm run dev`.

### Environment Setup

- **Development in the plugins folder of your vault:**
  - Set the `REAL` variable to `-1` in the `.env` file. This indicates that you are developing your plugin directly in the plugins folder of your vault.

- **Development outside the vault:**
  - If your plugin's source code is outside the vault, set the `REAL` variable to `0` in the `.env` file. In this case, the necessary files, including `main.js`, will be automatically copied to the vault during development. During the build process, the JS and CSS files will be generated in the folder containing your source code. You can then push to GitHub and create a release directly from this folder using the commands listed below.

### Managing Vaults (IMPORTANT)

- Two vault paths are defined in the `.env` file:
  1. One for your **development vault** to protect your main vault.
  2. One for your **main vault**, where you can perform a real installation.

- Depending on the command executed, the `REAL` variable will take a different value and adapt to the corresponding path.

### Available Commands

- **`npm run dev` and `npm start`**: Used for development in your development vault. `npm start` opens Visual Studio Code, runs `npm install`, and then `npm run dev`, allowing for a quick start from the folder containing the source code.

- **`npm run build`**: Builds the project in the folder containing the source code.

- **`npm run real`**: Equivalent to a traditional installation of the plugin in your main vault. Note: `main.js` is generated via a build.

- **`npm run bacp`**: After development and before creating a release. `b` stands for build, and `acp` stands for add, commit, push. You will be prompted for the commit message.

- **`npm run acp`**: Performs add, commit, push without going through the build step.

- **`npm run version`**: Asks for the type of version update, modifies the relevant files, and then performs an add, commit, push. It makes sense to run this after `bacp`.

- **`npm run release`**: Asks for the release title and creates the release. This command works with the configurations in the `.github` folder. The title can be multiline by using `\n`.
