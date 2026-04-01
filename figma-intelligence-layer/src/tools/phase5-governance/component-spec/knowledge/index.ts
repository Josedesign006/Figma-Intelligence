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
import { iconKnowledge } from "./icon.js";
import { linkKnowledge } from "./link.js";
import { menuKnowledge } from "./menu.js";
import { spinnerKnowledge } from "./spinner.js";
import { breadcrumbKnowledge } from "./breadcrumb.js";
import { tagKnowledge } from "./tag.js";
import { navbarKnowledge } from "./navbar.js";
import { textareaKnowledge } from "./textarea.js";
import { searchKnowledge } from "./search.js";
import { comboboxKnowledge } from "./combobox.js";
import { datepickerKnowledge } from "./datepicker.js";
import { numberInputKnowledge } from "./number-input.js";
import { formKnowledge } from "./form.js";
import { paginationKnowledge } from "./pagination.js";
import { listKnowledge } from "./list.js";
import { treeviewKnowledge } from "./treeview.js";
import { typographyKnowledge } from "./typography.js";
import { dividerKnowledge } from "./divider.js";
import { skeletonKnowledge } from "./skeleton.js";
import { popoverKnowledge } from "./popover.js";
import { dropdownMenuKnowledge } from "./dropdown-menu.js";
import { avatarGroupKnowledge } from "./avatar-group.js";
import { gridKnowledge } from "./grid.js";
import { emptyStateKnowledge } from "./empty-state.js";
import { bannerKnowledge } from "./banner.js";
import { drawerKnowledge } from "./drawer.js";
import { segmentedControlKnowledge } from "./segmented-control.js";
import { stepperKnowledge } from "./stepper.js";
import { fileUploaderKnowledge } from "./file-uploader.js";
import { inlineMessageKnowledge } from "./inline-message.js";
import { toolbarKnowledge } from "./toolbar.js";
import { calendarKnowledge } from "./calendar.js";
import { timePickerKnowledge } from "./time-picker.js";
import { rangeSliderKnowledge } from "./range-slider.js";
import { inlineEditKnowledge } from "./inline-edit.js";
import { statusDotKnowledge } from "./status-dot.js";
import { ratingKnowledge } from "./rating.js";
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
  icon: iconKnowledge,
  link: linkKnowledge,
  menu: menuKnowledge,
  spinner: spinnerKnowledge,
  breadcrumb: breadcrumbKnowledge,
  tag: tagKnowledge,
  navbar: navbarKnowledge,
  textarea: textareaKnowledge,
  search: searchKnowledge,
  combobox: comboboxKnowledge,
  datepicker: datepickerKnowledge,
  numberinput: numberInputKnowledge,
  form: formKnowledge,
  pagination: paginationKnowledge,
  list: listKnowledge,
  treeview: treeviewKnowledge,
  typography: typographyKnowledge,
  divider: dividerKnowledge,
  skeleton: skeletonKnowledge,
  popover: popoverKnowledge,
  dropdownmenu: dropdownMenuKnowledge,
  avatargroup: avatarGroupKnowledge,
  grid: gridKnowledge,
  emptystate: emptyStateKnowledge,
  banner: bannerKnowledge,
  drawer: drawerKnowledge,
  segmentedcontrol: segmentedControlKnowledge,
  stepper: stepperKnowledge,
  fileuploader: fileUploaderKnowledge,
  inlinemessage: inlineMessageKnowledge,
  toolbar: toolbarKnowledge,
  calendar: calendarKnowledge,
  timepicker: timePickerKnowledge,
  rangeslider: rangeSliderKnowledge,
  inlineedit: inlineEditKnowledge,
  statusdot: statusDotKnowledge,
  rating: ratingKnowledge,
};

export function getComponentKnowledge(type?: string): ComponentKnowledge {
  if (!type) return defaultKnowledge;
  return KNOWLEDGE_MAP[type] ?? defaultKnowledge;
}
