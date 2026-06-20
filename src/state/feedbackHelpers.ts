/**
 * Feedback helpers — map game events to typed feedback messages.
 * FEEDBACK-ALERTS-06: Uses existing statusHelpers and localization.
 */
import { t } from '../config/localization';
import type { FeedbackSeverity } from './feedbackStore';
import type { BuildBlockReason, ProductionBlockReason } from './statusHelpers';

/** Map a BuildBlockReason to a feedback message + severity. */
export function buildBlockFeedback(reason: BuildBlockReason): { message: string; type: FeedbackSeverity } {
  switch (reason) {
    case 'no-idle-builder': return { message: t('fb_noBuilder'), type: 'warning' };
    case 'insufficient-matter': return { message: t('fb_noMatter'), type: 'warning' };
    case 'not-buildable': return { message: t('fb_notBuildable'), type: 'error' };
  }
}

/** Map a ProductionBlockReason to a feedback message + severity. */
export function productionBlockFeedback(reason: ProductionBlockReason): { message: string; type: FeedbackSeverity } {
  switch (reason) {
    case 'no-factory': return { message: t('fb_noFactory'), type: 'warning' };
    case 'queue-full': return { message: t('fb_queueFull'), type: 'warning' };
    case 'insufficient-matter': return { message: t('fb_noMatter'), type: 'warning' };
    case 'insufficient-element': return { message: t('fb_noElement'), type: 'warning' };
    case 'unit-cap-reached': return { message: t('fb_unitCap'), type: 'warning' };
  }
}

/** Control group feedback messages. */
export function controlGroupAssigned(groupNum: number, count: number): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_groupAssigned').replace('{group}', String(groupNum)).replace('{count}', String(count)), type: 'success' };
}

export function controlGroupEmpty(groupNum: number): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_groupEmpty').replace('{group}', String(groupNum)), type: 'warning' };
}

export function controlGroupRecalled(groupNum: number, count: number): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_groupRecalled').replace('{group}', String(groupNum)).replace('{count}', String(count)), type: 'info' };
}

/** Build/production lifecycle feedback. */
export function constructionStarted(buildingType: string): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_buildStarted').replace('{type}', buildingType), type: 'info' };
}

export function constructionCompleted(buildingType: string): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_buildComplete').replace('{type}', buildingType), type: 'success' };
}

export function noSelectionFeedback(): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_noSelection'), type: 'warning' };
}

export function commandUnavailableFeedback(): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_commandUnavailable'), type: 'warning' };
}

/** Idle worker feedback. */
export function idleWorkerFeedback(count: number): { message: string; type: FeedbackSeverity } {
  return { message: t('fb_idleWorkers').replace('{count}', String(count)), type: 'info' };
}
