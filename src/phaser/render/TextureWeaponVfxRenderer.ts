import Phaser from 'phaser';
import type { VfxProfile } from '../../config/blockoutProfiles';
import { getWeaponVfxProfile } from '../../config/blockoutVfxData';
import type { BlockoutWeaponVfxEvent } from '../../state/blockoutWeaponVfx';
import { getVfxEvents } from '../../state/blockoutWeaponVfx';

const TEXTURE_VFX_DEPTH = 180;
const MAX_POOLED_IMAGES = 96;
const MUZZLE_SCALE = 1.7;
const TRAIL_WIDTH_SCALE = 2;
const IMPACT_SCALE = 1.65;
const SMOKE_SCALE = 1.5;
const NOISE_SCALE = 1.45;

type TextureRole = 'muzzle' | 'trail' | 'impact' | 'smoke' | 'noise';

interface TextureNode {
  role: TextureRole;
  image: Phaser.GameObjects.Image;
}

interface EventVisual {
  nodes: TextureNode[];
}

/**
 * Texture overlay for the existing Graphics-based weapon VFX renderer.
 *
 * Combat timing and damage remain owned by the state layer. This renderer only
 * decorates already-created VFX events with pooled PNG images. When a texture
 * is absent or the pool budget is exhausted, the existing Graphics renderer
 * remains the fallback.
 */
export class TextureWeaponVfxRenderer {
  private readonly scene: Phaser.Scene;
  private readonly activeVisuals = new Map<number, EventVisual>();
  private readonly allImages: Phaser.GameObjects.Image[] = [];
  private readonly freeImages: Phaser.GameObjects.Image[] = [];
  private readonly missingTextureKeys = new Set<string>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  syncFromState(nowMs: number): void {
    const liveEventIds = new Set<number>();

    for (const event of getVfxEvents()) {
      const ageMs = nowMs - event.createdAt;
      if (ageMs < 0 || ageMs >= event.durationMs) continue;

      const profile = getWeaponVfxProfile(event.weaponId);
      if (!profile || !this.hasTextureConfiguration(profile)) continue;

      liveEventIds.add(event.id);
      let visual = this.activeVisuals.get(event.id);
      if (!visual) {
        visual = this.createVisual(profile);
        if (visual.nodes.length === 0) continue;
        this.activeVisuals.set(event.id, visual);
      }

      this.updateVisual(visual, event, profile, ageMs);
    }

    for (const [eventId, visual] of this.activeVisuals) {
      if (liveEventIds.has(eventId)) continue;
      this.releaseVisual(visual);
      this.activeVisuals.delete(eventId);
    }
  }

  destroy(): void {
    this.activeVisuals.clear();
    this.freeImages.length = 0;
    this.missingTextureKeys.clear();
    for (const image of this.allImages) {
      image.destroy();
    }
    this.allImages.length = 0;
  }

  getPoolStats(): { active: number; pooled: number; free: number; limit: number } {
    return {
      active: this.activeVisuals.size,
      pooled: this.allImages.length,
      free: this.freeImages.length,
      limit: MAX_POOLED_IMAGES,
    };
  }

  private hasTextureConfiguration(profile: VfxProfile): boolean {
    return Boolean(
      profile.muzzleTextureKey
      || profile.trailTextureKey
      || profile.impactTextureKey
      || profile.smokeTextureKey
      || profile.noiseTextureKey,
    );
  }

  private createVisual(profile: VfxProfile): EventVisual {
    const nodes: TextureNode[] = [];
    this.addNode(nodes, 'muzzle', profile.muzzleTextureKey, true);
    this.addNode(nodes, 'trail', profile.trailTextureKey, true);
    this.addNode(nodes, 'impact', profile.impactTextureKey, true);
    this.addNode(nodes, 'smoke', profile.smokeTextureKey, false);
    this.addNode(nodes, 'noise', profile.noiseTextureKey, false);
    return { nodes };
  }

  private addNode(
    nodes: TextureNode[],
    role: TextureRole,
    textureKey: string | undefined,
    additive: boolean,
  ): void {
    if (!textureKey) return;
    if (!this.scene.textures.exists(textureKey)) {
      if (!this.missingTextureKeys.has(textureKey)) {
        this.missingTextureKeys.add(textureKey);
        console.warn(`[TextureWeaponVfxRenderer] Missing donor texture: ${textureKey}`);
      }
      return;
    }

    const image = this.acquireImage(textureKey);
    if (!image) return;
    image.setBlendMode(additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    nodes.push({ role, image });
  }

  private acquireImage(textureKey: string): Phaser.GameObjects.Image | null {
    let image = this.freeImages.pop() ?? null;
    if (!image) {
      if (this.allImages.length >= MAX_POOLED_IMAGES) return null;
      image = this.scene.add.image(0, 0, textureKey);
      image.setOrigin(0.5, 0.5);
      this.allImages.push(image);
    } else {
      image.setTexture(textureKey);
    }

    image.setDepth(TEXTURE_VFX_DEPTH);
    image.setActive(true);
    image.setVisible(true);
    image.setAlpha(1);
    image.setScale(1);
    image.setRotation(0);
    image.clearTint();
    return image;
  }

  private releaseVisual(visual: EventVisual): void {
    for (const node of visual.nodes) {
      const image = node.image;
      image.setActive(false);
      image.setVisible(false);
      image.setAlpha(0);
      image.clearTint();
      this.freeImages.push(image);
    }
  }

  private updateVisual(
    visual: EventVisual,
    event: BlockoutWeaponVfxEvent,
    profile: VfxProfile,
    ageMs: number,
  ): void {
    const progress = Phaser.Math.Clamp(ageMs / Math.max(1, event.durationMs), 0, 1);
    const fade = 1 - progress;
    const end = this.resolveEndPoint(event);
    const dx = end.x - event.originX;
    const dy = end.y - event.originY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    for (const node of visual.nodes) {
      switch (node.role) {
        case 'muzzle':
          this.updateMuzzle(node.image, event, profile, progress, fade);
          break;
        case 'trail':
          this.updateTrail(node.image, event, profile, end, distance, angle, fade);
          break;
        case 'impact':
          this.updateImpact(node.image, end, profile, progress, fade);
          break;
        case 'smoke':
          this.updateSmoke(node.image, end, profile, progress, fade);
          break;
        case 'noise':
          this.updateNoise(node.image, event, end, profile, progress, fade);
          break;
      }
    }
  }

  private updateMuzzle(
    image: Phaser.GameObjects.Image,
    event: BlockoutWeaponVfxEvent,
    profile: VfxProfile,
    progress: number,
    fade: number,
  ): void {
    const size = (profile.muzzleTextureSizePx ?? 34) * MUZZLE_SCALE;
    const pulse = 0.9 + Math.sin(progress * Math.PI) * 0.42;
    image.setPosition(event.originX, event.originY);
    image.setDisplaySize(size * pulse, size * pulse);
    image.setRotation(event.angle);
    image.setAlpha(Math.min(1, 0.2 + fade * 2.1));
    image.setTint(profile.color);
  }

  private updateTrail(
    image: Phaser.GameObjects.Image,
    event: BlockoutWeaponVfxEvent,
    profile: VfxProfile,
    end: { x: number; y: number },
    distance: number,
    angle: number,
    fade: number,
  ): void {
    const width = (profile.trailTextureWidthPx ?? Math.max(6, profile.width * 4))
      * TRAIL_WIDTH_SCALE;
    image.setPosition((event.originX + end.x) * 0.5, (event.originY + end.y) * 0.5);
    image.setRotation(angle);
    image.setDisplaySize(distance, width);
    image.setAlpha(Math.min(1, 0.16 + fade * 1.45));
    image.setTint(profile.color);
  }

  private updateImpact(
    image: Phaser.GameObjects.Image,
    end: { x: number; y: number },
    profile: VfxProfile,
    progress: number,
    fade: number,
  ): void {
    const size = (
      profile.impactTextureSizePx
      ?? Math.max(26, (profile.impactRadiusPx ?? 8) * 2.4)
    ) * IMPACT_SCALE;
    const grow = 0.78 + progress * 0.72;
    image.setPosition(end.x, end.y);
    image.setRotation(progress * 0.82);
    image.setDisplaySize(size * grow, size * grow);
    image.setAlpha(Math.min(1, 0.12 + fade * 1.75));
    image.setTint(profile.secondaryColor ?? profile.color);
  }

  private updateSmoke(
    image: Phaser.GameObjects.Image,
    end: { x: number; y: number },
    profile: VfxProfile,
    progress: number,
    fade: number,
  ): void {
    const size = (profile.smokeTextureSizePx ?? 48) * SMOKE_SCALE;
    const grow = 0.78 + progress * 1.08;
    image.setPosition(end.x, end.y - progress * 18);
    image.setRotation(progress * 0.52);
    image.setDisplaySize(size * grow, size * grow);
    image.setAlpha(Math.min(0.92, fade * 0.92));
    image.clearTint();
  }

  private updateNoise(
    image: Phaser.GameObjects.Image,
    event: BlockoutWeaponVfxEvent,
    end: { x: number; y: number },
    profile: VfxProfile,
    progress: number,
    fade: number,
  ): void {
    const size = (profile.noiseTextureSizePx ?? 38) * NOISE_SCALE;
    const t = 0.4 + progress * 0.4;
    image.setPosition(
      Phaser.Math.Linear(event.originX, end.x, t),
      Phaser.Math.Linear(event.originY, end.y, t),
    );
    image.setRotation(event.angle + progress * 0.72);
    image.setDisplaySize(size * (0.95 + progress * 0.62), size * (0.78 + progress * 0.52));
    image.setAlpha(Math.min(0.82, fade * 0.82));
    image.setTint(profile.color);
  }

  private resolveEndPoint(event: BlockoutWeaponVfxEvent): { x: number; y: number } {
    const targetIsUsable = Number.isFinite(event.targetX)
      && Number.isFinite(event.targetY)
      && Math.hypot(event.targetX - event.originX, event.targetY - event.originY) > 1;

    if (targetIsUsable) {
      return { x: event.targetX, y: event.targetY };
    }

    return {
      x: event.originX + Math.cos(event.angle) * event.rangePx,
      y: event.originY + Math.sin(event.angle) * event.rangePx,
    };
  }
}
