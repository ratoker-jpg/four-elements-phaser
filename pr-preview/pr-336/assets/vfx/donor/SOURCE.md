# Weapon VFX donor subset

Source repository: `ratoker-jpg/godot-tank-arena`

Source directory: `assets/vfx/processed/`

Imported subset: 10 alpha-processed PNG textures used by the Phaser weapon VFX overlay.

The donor repository's `docs/vfx_asset_audit.md` records these files as processed derivatives of selected textures from **LeLu's Noise Pack** and states that the local source readme permits hobby and commercial game use without required credit.

This directory intentionally excludes:

- real-smoke/After Effects frames, because their reusable licensing was not documented clearly enough;
- ProTanki textures;
- Godot materials, scenes and generated import files;
- unused textures from the donor's larger runtime asset set.

The selected PNG files are copied byte-for-byte without re-encoding. `npm run validate:vfx-alpha` verifies that the imported files retain transparent corners and do not render as opaque square cards.
