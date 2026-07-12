import type { MapData, ResourceType } from './types';
import type { AcceptedResourceClassId } from '../config/coreMechanicsTypes';
import { ACCEPTED_RESOURCE_CLASS_IDS } from '../config/coreMechanicsTypes';
import { validateCenterInfinityContract } from './centerInfinity';
import { validateFourCornerMapFairness } from './fourCornerFairness';

export interface GeneratedMapValidation {
  valid: boolean;
  score: number;
  issues: string[];
}

/** Validate structural playability invariants without constructing GameState. */
export function validateGeneratedMap(mapData: MapData): GeneratedMapValidation {
  const issues: string[] = [];
  let score = 0;
  const hqCenterX = mapData.hq.tx + 1;
  const hqCenterY = mapData.hq.ty + 1;

  const nearResources = mapData.resources.filter(resource => {
    const distance = Math.sqrt((resource.tx - hqCenterX) ** 2 + (resource.ty - hqCenterY) ** 2);
    return distance <= 10;
  });
  if (nearResources.length >= 4) {
    score += 40;
  } else if (nearResources.length >= 2) {
    score += 20;
    issues.push(`Only ${nearResources.length} resources near HQ`);
  } else {
    issues.push(`Insufficient resources near HQ: ${nearResources.length}`);
  }

  let hqClear = true;
  for (const resource of mapData.resources) {
    for (let dy = 0; dy < resource.footprint; dy++) {
      for (let dx = 0; dx < resource.footprint; dx++) {
        const tx = resource.tx + dx;
        const ty = resource.ty + dy;
        if (
          tx >= mapData.hq.tx - 1 && tx <= mapData.hq.tx + 3
          && ty >= mapData.hq.ty - 1 && ty <= mapData.hq.ty + 3
        ) {
          hqClear = false;
        }
      }
    }
  }
  if (hqClear) score += 30;
  else issues.push('Resources overlap HQ area');

  const resourceTiles = new Set<string>();
  let noOverlap = true;
  for (const resource of mapData.resources) {
    for (let dy = 0; dy < resource.footprint; dy++) {
      for (let dx = 0; dx < resource.footprint; dx++) {
        const key = `${resource.tx + dx},${resource.ty + dy}`;
        if (resourceTiles.has(key)) noOverlap = false;
        resourceTiles.add(key);
      }
    }
  }
  if (noOverlap) score += 20;
  else issues.push('Resources overlap each other');

  const hasInfinite = mapData.resources.some(
    resource => resource.type === 'infinite' || resource.resourceClass === 'infinite',
  );
  if (hasInfinite) score += 10;
  else issues.push('No infinite resource deposit');

  const acceptedClasses = new Set<string>(ACCEPTED_RESOURCE_CLASS_IDS);
  let missingClassCount = 0;
  let invalidClassCount = 0;
  let infiniteCount = 0;

  for (const resource of mapData.resources) {
    if (!resource.resourceClass) missingClassCount++;
    else if (!acceptedClasses.has(resource.resourceClass)) invalidClassCount++;
    if (resource.resourceClass === 'infinite') infiniteCount++;
  }

  if (missingClassCount > 0) {
    issues.push(`${missingClassCount} generated resource(s) missing resourceClass`);
  }
  if (invalidClassCount > 0) {
    issues.push(`${invalidClassCount} generated resource(s) have invalid resourceClass`);
  }
  if (infiniteCount !== 1) {
    issues.push(`Expected exactly 1 infinite resourceClass deposit, found ${infiniteCount}`);
  }

  for (const issue of validateCenterInfinityContract(mapData)) {
    if (!issues.includes(issue)) issues.push(issue);
  }
  if (mapData.headquarters?.length === 4) {
    for (const issue of validateFourCornerMapFairness(mapData).issues) {
      if (!issues.includes(issue)) issues.push(issue);
    }
  }

  return { valid: issues.length === 0, score, issues };
}

export interface GeneratedMapQualitySummary {
  width: number;
  height: number;
  resourceCount: number;
  resourcesByType: Record<ResourceType, number>;
  resourcesByClass: Partial<Record<AcceptedResourceClassId, number>>;
  starterResourceCount: number;
  hasInfiniteDeposit: boolean;
  obstacleCount: number;
  decorCount: number;
  validationPassed: boolean;
  validationIssues: string[];
}

/** Build stable diagnostics from the same invariants used by retry validation. */
export function summarizeGeneratedMapQuality(mapData: MapData): GeneratedMapQualitySummary {
  const hqCenterX = mapData.hq.tx + 1;
  const hqCenterY = mapData.hq.ty + 1;
  const resourcesByType: Record<ResourceType, number> = {
    small: 0,
    medium: 0,
    large: 0,
    infinite: 0,
  };
  const resourcesByClass: Partial<Record<AcceptedResourceClassId, number>> = {};

  for (const resource of mapData.resources) {
    resourcesByType[resource.type]++;
    if (resource.resourceClass) {
      resourcesByClass[resource.resourceClass] = (resourcesByClass[resource.resourceClass] ?? 0) + 1;
    }
  }

  const starterResourceCount = mapData.resources.filter(resource => {
    const distance = Math.sqrt((resource.tx - hqCenterX) ** 2 + (resource.ty - hqCenterY) ** 2);
    return distance <= 10;
  }).length;

  const hasInfiniteDeposit = mapData.resources.some(
    resource => resource.type === 'infinite' || resource.resourceClass === 'infinite',
  );
  const validation = validateGeneratedMap(mapData);

  return {
    width: mapData.width,
    height: mapData.height,
    resourceCount: mapData.resources.length,
    resourcesByType,
    resourcesByClass,
    starterResourceCount,
    hasInfiniteDeposit,
    obstacleCount: mapData.obstacles.length,
    decorCount: mapData.decor.length,
    validationPassed: validation.valid,
    validationIssues: validation.issues,
  };
}
