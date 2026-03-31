/**
 * Knowledge base lookup — returns component-type-specific design knowledge
 */
import type { ComponentKnowledge } from "../types.js";

import { buttonKnowledge } from "./button.js";
import { checkboxKnowledge } from "./checkbox.js";
import { inputKnowledge } from "./input.js";
import { selectKnowledge } from "./select.js";
import { toggleKnowledge } from "./toggle.js";
import { radioKnowledge } from "./radio.js";
import { modalKnowledge } from "./modal.js";
import { tabsKnowledge } from "./tabs.js";
import { cardKnowledge } from "./card.js";
import { toastKnowledge } from "./toast.js";
import { accordionKnowledge } from "./accordion.js";
import { tooltipKnowledge } from "./tooltip.js";
import { sliderKnowledge } from "./slider.js";
import { alertKnowledge } from "./alert.js";
import { badgeKnowledge } from "./badge.js";
import { avatarKnowledge } from "./avatar.js";
import { chipKnowledge } from "./chip.js";
import { tableKnowledge } from "./table.js";
import { navigationKnowledge } from "./navigation.js";
import { progressKnowledge } from "./progress.js";
import { defaultKnowledge } from "./_default.js";

const KNOWLEDGE_MAP: Record<string, ComponentKnowledge> = {
  button: buttonKnowledge,
  checkbox: checkboxKnowledge,
  input: inputKnowledge,
  select: selectKnowledge,
  toggle: toggleKnowledge,
  radio: radioKnowledge,
  modal: modalKnowledge,
  tabs: tabsKnowledge,
  card: cardKnowledge,
  toast: toastKnowledge,
  accordion: accordionKnowledge,
  tooltip: tooltipKnowledge,
  slider: sliderKnowledge,
  alert: alertKnowledge,
  badge: badgeKnowledge,
  avatar: avatarKnowledge,
  chip: chipKnowledge,
  table: tableKnowledge,
  navigation: navigationKnowledge,
  progress: progressKnowledge,
};

export function getComponentKnowledge(type?: string): ComponentKnowledge {
  if (!type) return defaultKnowledge;
  return KNOWLEDGE_MAP[type] ?? defaultKnowledge;
}
