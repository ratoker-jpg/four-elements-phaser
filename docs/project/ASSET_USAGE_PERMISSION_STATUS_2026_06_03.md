# ASSET_USAGE_PERMISSION_STATUS_2026_06_03.md

Status: asset usage permission received / sanitized public project record  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-03

---

## 1. Purpose

This document records the project-level status for using the external TankViewer source asset package in Four Elements Phaser.

Asset package:

```text
TankViewer_needed_files.zip
```

The package may include:

```text
- 3D models
- textures
- details maps
- lightmaps
- UV/mapping data
- related source files
- exported or converted derivatives
```

This document is intentionally sanitized for the public repository. The original signed/written permission file contains personal contact details and should be stored outside the public repository.

---

## 2. Permission source

A final written permission file was provided on 2026-06-03:

```text
Asset_Usage_Permission_Final.txt
```

The private permission file states that the provider is the personal rights holder of the specific assets included in the package and has the necessary rights, permission, and authority to provide the asset package for use in Four Elements Phaser.

The private permission file should be retained in private project records / private asset storage.

Do not commit the private permission file to the public repository unless the project owner explicitly accepts publishing the personal details inside it.

---

## 3. Granted usage scope, summarized

The received permission grants broad rights for Four Elements Phaser, including:

```text
- access, copy, store, back up and inspect source files
- import, open, convert, export, rename, reorganize and process files
- modify, edit, recolor, rebalance, crop, optimize, resize, compress, retopologize, remap, combine or otherwise adapt assets
- render 3D models into 2D sprites, spritesheets, atlases, PNG, WebP, video, thumbnails, previews, UI assets and other game-ready formats
- create derivative works and derivative assets
- combine assets with other assets, code, shaders, materials, tools, pipelines and project files
- use assets and derivatives in development, testing, demos, previews, marketing, trailers, screenshots, videos, public builds, private builds and released versions
- use assets and derivatives in commercial and non-commercial contexts
- store source files and derivative files in private or public repositories, asset storage, build pipelines and team workspaces
- distribute, publish and ship derivative assets and project builds containing these assets
- share source and derivative files with collaborators, contractors, publishers, build systems, hosting providers and team members working on the project
```

The permission is described as:

```text
worldwide
perpetual
irrevocable
royalty-free
non-exclusive
```

---

## 4. Restrictions, summarized

The received permission indicates:

```text
- no additional restrictions
- commercial use is allowed
- public distribution of derived game-ready assets is allowed
- source files may be stored in the project repository
- source files may also be published publicly
- attribution is not required
```

Despite this broad permission, the current project policy is more conservative:

```text
- Keep source 3D files and original texture packages in private asset storage by default.
- Commit only derived game-ready assets to the public repository unless there is a deliberate project decision to publish source assets.
- Avoid publishing private contact details in the public repository.
```

---

## 5. Runtime policy

Do not load `.3ds` models directly in Phaser runtime.

Accepted pipeline direction:

```text
TankViewer source assets
-> offline import/conversion pipeline
-> material reconstruction using details/lightmaps
-> optional recolor/adaptation
-> render body/turret sprites or atlases
-> generate metadata
-> Phaser loads PNG/WebP/atlas + JSON metadata
```

Runtime should use game-ready assets, not raw 3D source files.

---

## 6. Integration boundary

The permission status does not mean the project should immediately commit or integrate all source assets.

Before integration, a future implementation/system audit should define:

```text
- exact asset inventory
- import/conversion feasibility
- Blender or converter pipeline
- material reconstruction using details/lightmaps
- body/turret separation
- number of render directions
- sprite/atlas dimensions
- metadata requirements: anchor, ground point, turret socket, barrel tip, bounds, footprint class
- storage policy for source files vs generated assets
- how generated assets fit CAMERA_PROJECTION_CONTRACT.md
- how asset work fits the accepted Core Mechanics Roadmap
```

---

## 7. Public repository policy

This public repository should not expose personal contact data from the permission document.

Recommended storage model:

```text
Public repo:
- sanitized permission status document
- generated game-ready sprites/atlases when approved
- metadata and pipeline scripts when approved

Private storage:
- original Asset_Usage_Permission_Final.txt
- original TankViewer_needed_files.zip
- raw .3ds files
- original source textures/lightmaps/details unless explicitly approved for public storage
```

---

## 8. Current decision

The asset package is allowed for project planning and pipeline feasibility work.

The next roadmap/audit may include a TankViewer source asset pipeline section.

Do not start mass asset generation or final art integration until the pipeline is audited and accepted.
