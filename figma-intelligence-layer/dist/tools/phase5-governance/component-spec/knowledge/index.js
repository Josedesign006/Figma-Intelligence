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
};
function getComponentKnowledge(type) {
    if (!type)
        return _default_js_1.defaultKnowledge;
    return KNOWLEDGE_MAP[type] ?? _default_js_1.defaultKnowledge;
}
//# sourceMappingURL=index.js.map