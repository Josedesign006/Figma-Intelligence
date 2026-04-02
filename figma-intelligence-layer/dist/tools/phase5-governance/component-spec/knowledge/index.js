"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComponentKnowledge = getComponentKnowledge;
const button_js_1 = require("./button.js");
const checkbox_js_1 = require("./checkbox.js");
const input_js_1 = require("./input.js");
const select_js_1 = require("./select.js");
const toggle_js_1 = require("./toggle.js");
const radio_js_1 = require("./radio.js");
const modal_js_1 = require("./modal.js");
const tabs_js_1 = require("./tabs.js");
const card_js_1 = require("./card.js");
const toast_js_1 = require("./toast.js");
const accordion_js_1 = require("./accordion.js");
const tooltip_js_1 = require("./tooltip.js");
const slider_js_1 = require("./slider.js");
const alert_js_1 = require("./alert.js");
const badge_js_1 = require("./badge.js");
const avatar_js_1 = require("./avatar.js");
const chip_js_1 = require("./chip.js");
const table_js_1 = require("./table.js");
const navigation_js_1 = require("./navigation.js");
const progress_js_1 = require("./progress.js");
const icon_js_1 = require("./icon.js");
const link_js_1 = require("./link.js");
const menu_js_1 = require("./menu.js");
const spinner_js_1 = require("./spinner.js");
const breadcrumb_js_1 = require("./breadcrumb.js");
const tag_js_1 = require("./tag.js");
const navbar_js_1 = require("./navbar.js");
const textarea_js_1 = require("./textarea.js");
const search_js_1 = require("./search.js");
const combobox_js_1 = require("./combobox.js");
const datepicker_js_1 = require("./datepicker.js");
const number_input_js_1 = require("./number-input.js");
const form_js_1 = require("./form.js");
const pagination_js_1 = require("./pagination.js");
const list_js_1 = require("./list.js");
const treeview_js_1 = require("./treeview.js");
const typography_js_1 = require("./typography.js");
const divider_js_1 = require("./divider.js");
const skeleton_js_1 = require("./skeleton.js");
const popover_js_1 = require("./popover.js");
const dropdown_menu_js_1 = require("./dropdown-menu.js");
const avatar_group_js_1 = require("./avatar-group.js");
const grid_js_1 = require("./grid.js");
const empty_state_js_1 = require("./empty-state.js");
const banner_js_1 = require("./banner.js");
const drawer_js_1 = require("./drawer.js");
const segmented_control_js_1 = require("./segmented-control.js");
const stepper_js_1 = require("./stepper.js");
const file_uploader_js_1 = require("./file-uploader.js");
const inline_message_js_1 = require("./inline-message.js");
const toolbar_js_1 = require("./toolbar.js");
const calendar_js_1 = require("./calendar.js");
const time_picker_js_1 = require("./time-picker.js");
const range_slider_js_1 = require("./range-slider.js");
const inline_edit_js_1 = require("./inline-edit.js");
const status_dot_js_1 = require("./status-dot.js");
const rating_js_1 = require("./rating.js");
const _default_js_1 = require("./_default.js");
const KNOWLEDGE_MAP = {
    button: button_js_1.buttonKnowledge,
    checkbox: checkbox_js_1.checkboxKnowledge,
    input: input_js_1.inputKnowledge,
    select: select_js_1.selectKnowledge,
    toggle: toggle_js_1.toggleKnowledge,
    radio: radio_js_1.radioKnowledge,
    modal: modal_js_1.modalKnowledge,
    tabs: tabs_js_1.tabsKnowledge,
    card: card_js_1.cardKnowledge,
    toast: toast_js_1.toastKnowledge,
    accordion: accordion_js_1.accordionKnowledge,
    tooltip: tooltip_js_1.tooltipKnowledge,
    slider: slider_js_1.sliderKnowledge,
    alert: alert_js_1.alertKnowledge,
    badge: badge_js_1.badgeKnowledge,
    avatar: avatar_js_1.avatarKnowledge,
    chip: chip_js_1.chipKnowledge,
    table: table_js_1.tableKnowledge,
    navigation: navigation_js_1.navigationKnowledge,
    progress: progress_js_1.progressKnowledge,
    icon: icon_js_1.iconKnowledge,
    link: link_js_1.linkKnowledge,
    menu: menu_js_1.menuKnowledge,
    spinner: spinner_js_1.spinnerKnowledge,
    breadcrumb: breadcrumb_js_1.breadcrumbKnowledge,
    tag: tag_js_1.tagKnowledge,
    navbar: navbar_js_1.navbarKnowledge,
    textarea: textarea_js_1.textareaKnowledge,
    search: search_js_1.searchKnowledge,
    combobox: combobox_js_1.comboboxKnowledge,
    datepicker: datepicker_js_1.datepickerKnowledge,
    numberinput: number_input_js_1.numberInputKnowledge,
    form: form_js_1.formKnowledge,
    pagination: pagination_js_1.paginationKnowledge,
    list: list_js_1.listKnowledge,
    treeview: treeview_js_1.treeviewKnowledge,
    typography: typography_js_1.typographyKnowledge,
    divider: divider_js_1.dividerKnowledge,
    skeleton: skeleton_js_1.skeletonKnowledge,
    popover: popover_js_1.popoverKnowledge,
    dropdownmenu: dropdown_menu_js_1.dropdownMenuKnowledge,
    avatargroup: avatar_group_js_1.avatarGroupKnowledge,
    grid: grid_js_1.gridKnowledge,
    emptystate: empty_state_js_1.emptyStateKnowledge,
    banner: banner_js_1.bannerKnowledge,
    drawer: drawer_js_1.drawerKnowledge,
    segmentedcontrol: segmented_control_js_1.segmentedControlKnowledge,
    stepper: stepper_js_1.stepperKnowledge,
    fileuploader: file_uploader_js_1.fileUploaderKnowledge,
    inlinemessage: inline_message_js_1.inlineMessageKnowledge,
    toolbar: toolbar_js_1.toolbarKnowledge,
    calendar: calendar_js_1.calendarKnowledge,
    timepicker: time_picker_js_1.timePickerKnowledge,
    rangeslider: range_slider_js_1.rangeSliderKnowledge,
    inlineedit: inline_edit_js_1.inlineEditKnowledge,
    statusdot: status_dot_js_1.statusDotKnowledge,
    rating: rating_js_1.ratingKnowledge,
};
function getComponentKnowledge(type) {
    if (!type)
        return _default_js_1.defaultKnowledge;
    return KNOWLEDGE_MAP[type] ?? _default_js_1.defaultKnowledge;
}
//# sourceMappingURL=index.js.map