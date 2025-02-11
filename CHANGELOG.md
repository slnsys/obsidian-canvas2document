# Changelog for Obsidian Plugin **Canvas2Document**

# 2025-02-11: 1.3.0 support for Edge labels, YAML frontmatter, Ribbon buttons
- support reading embedded YAML frontmatter in MD documents (toggable via settings)
- support reading edge labels in Canvas (toggable via settings)
- added action buttons for the Obsidian ribbon bar
- added a settings page
- verified testing on Linux and MacOS
- support conversion of embedded online links like all other media types
- optimized display size of embedded media (images, pdf, online links)

# 2024-11-12: 1.2.3 Bugfix Canvas embedding and support for other embedded file types
- fixed crash when having special canvas embedding
- added embedding support for more media types: Video, Audio

# 2024-08-15: 1.2.2 Bugfix for handling edges between nodes and groups

# 2024-06-24: 1.2.1 Filesystem clearings
 - better filenames and no cluttering of folders: overwriting of files with same name with confirmation
 - better filemanagement in writing temp files
 - added "Step..." prefixes to commands

# 2024-05-15: 1.2.0 Hierarchy, Ordering, more Metadata for navigation

**Improvements**

- Hierarchy reading: brings the canvas hierarchical relations and ordering as TOC-tree to navigate
- Flexibility in Canvas Reading: recognizes multiple areas with multiple tree/graph structures
- Better metadata on navigational headings: data from nodes and files in navigational headers
- Filenames as headings in resultdoc

# 2024-04-22: 1.1.0 Conversion processing

**Feature completion**

Conversion now consists of 2 steps: generating a canvas level intermediate document and a cleared target document to continue editing in content level.

**Improvements**

- documentation optimization
- added slim inline documentation in generated process media

**Errors**

- Fixed an error when the canvas files being located in the root of the obsidian vault
- Fixed handling of variations of media filenames

## Initial Releases

2024-04-11: releases for submission
2024-03-20: releases for submission
