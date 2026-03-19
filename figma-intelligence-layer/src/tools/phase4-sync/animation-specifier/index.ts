// ─────────────────────────────────────────────────────────────────────────────
// Animation Specifier
// Extracts prototype animation data from Figma connections and generates
// production-ready animation code for framer-motion, CSS, Swift, and Android.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AnimationSpecifierArgs {
  fileKey?: string;
  frameNodeId?: string;
  outputFormat: "json" | "framer-motion" | "css" | "swift" | "android" | "all";
}

export interface AnimationSpec {
  name: string;
  fromId: string;
  toId: string;
  duration: number;
  easing: string;
  easingValues: number[];
  direction: string;
  type: string;
  isSpring: boolean;
  springStiffness?: number;
  springDamping?: number;
}

export interface AnimationSpecifierResult {
  animations: AnimationSpec[];
  code: {
    json?: string;
    framerMotion?: string;
    css?: string;
    swift?: string;
    android?: string;
  };
  totalConnections: number;
  animatedConnections: number;
}

// ─── Easing maps ──────────────────────────────────────────────────────────────

const EASING_CSS_MAP: Record<string, string> = {
  EASE_IN:     "cubic-bezier(0.4, 0, 1, 1)",
  EASE_OUT:    "cubic-bezier(0, 0, 0.2, 1)",
  EASE_IN_OUT: "cubic-bezier(0.4, 0, 0.2, 1)",
  LINEAR:      "cubic-bezier(0, 0, 1, 1)",
  SPRING:      "cubic-bezier(0.4, 0, 0.2, 1)", // approximation for CSS
};

const EASING_SWIFT_MAP: Record<string, string> = {
  EASE_IN:     ".easeIn",
  EASE_OUT:    ".easeOut",
  EASE_IN_OUT: ".easeInOut",
  LINEAR:      ".linear",
  SPRING:      ".spring(response: 0.4, dampingFraction: 0.7)",
};

const EASING_CUBIC_MAP: Record<string, number[]> = {
  EASE_IN:     [0.4, 0, 1, 1],
  EASE_OUT:    [0, 0, 0.2, 1],
  EASE_IN_OUT: [0.4, 0, 0.2, 1],
  LINEAR:      [0, 0, 1, 1],
  SPRING:      [0.4, 0, 0.2, 1],
};

// ─── Connection parser ────────────────────────────────────────────────────────

interface RawConnection {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\s]/g, "")
    .trim()
    .replace(/\s+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toLowerCase());
}

function detectEasing(action: Record<string, unknown>): string {
  const transition = action["transition"] as Record<string, unknown> | undefined;
  if (!transition) return "EASE_IN_OUT";

  const easing = transition["easing"] as Record<string, unknown> | string | undefined;
  if (!easing) return "EASE_IN_OUT";

  if (typeof easing === "string") return easing;

  const type = (easing["type"] as string | undefined)?.toUpperCase();
  if (!type) return "EASE_IN_OUT";

  if (type.includes("SPRING") || type === "SPRING_PRESET") return "SPRING";
  if (type.includes("EASE_IN_AND_OUT") || type.includes("EASE_IN_OUT")) return "EASE_IN_OUT";
  if (type.includes("EASE_IN")) return "EASE_IN";
  if (type.includes("EASE_OUT")) return "EASE_OUT";
  if (type.includes("LINEAR")) return "LINEAR";
  return "EASE_IN_OUT";
}

function detectTransitionType(action: Record<string, unknown>): { type: string; direction: string } {
  const transition = action["transition"] as Record<string, unknown> | undefined;
  if (!transition) return { type: "DISSOLVE", direction: "none" };

  const rawType = (transition["type"] as string | undefined)?.toUpperCase() ?? "DISSOLVE";
  const direction = (transition["direction"] as string | undefined)?.toUpperCase() ?? "none";

  return { type: rawType, direction };
}

function parseConnections(connections: RawConnection[]): AnimationSpec[] {
  const specs: AnimationSpec[] = [];

  for (const conn of connections) {
    const transition = (conn.action["transition"] as Record<string, unknown> | undefined);
    if (!transition) continue;

    const durationRaw = transition["duration"] as number | undefined;
    const duration = typeof durationRaw === "number" ? durationRaw : 0.3;

    const easingKey = detectEasing(conn.action);
    const { type, direction } = detectTransitionType(conn.action);
    const isSpring = easingKey === "SPRING";

    const spec: AnimationSpec = {
      name: sanitizeName(`${conn.fromName}To${conn.toName}`),
      fromId: conn.fromId,
      toId: conn.toId,
      duration,
      easing: easingKey,
      easingValues: EASING_CUBIC_MAP[easingKey] ?? [0.4, 0, 0.2, 1],
      direction,
      type,
      isSpring,
    };

    if (isSpring) {
      spec.springStiffness = 300;
      spec.springDamping = 30;
    }

    specs.push(spec);
  }

  return specs;
}

// ─── Code generators ──────────────────────────────────────────────────────────

function getSlideAxis(type: string, direction: string): { axis: "x" | "y"; sign: number } {
  const dir = direction.toUpperCase();

  if (type === "PUSH" || type === "SLIDE_IN" || type === "SLIDE_OUT" ||
      type === "MOVE_IN" || type === "MOVE_OUT") {
    if (dir === "LEFT")  return { axis: "x", sign: -1 };
    if (dir === "RIGHT") return { axis: "x", sign: 1 };
    if (dir === "UP")    return { axis: "y", sign: -1 };
    if (dir === "DOWN")  return { axis: "y", sign: 1 };
  }
  return { axis: "x", sign: 1 };
}

function getClosedVariant(spec: AnimationSpec): Record<string, unknown> {
  const type = spec.type.toUpperCase();
  const dir = spec.direction.toUpperCase();

  if (type === "DISSOLVE") {
    return { opacity: 0 };
  }

  if (type === "SMART_ANIMATE") {
    return { opacity: 0, scale: 0.95 };
  }

  if (
    type === "PUSH" || type === "SLIDE_IN" || type === "SLIDE_OUT" ||
    type === "MOVE_IN" || type === "MOVE_OUT"
  ) {
    const { axis, sign } = getSlideAxis(type, dir);
    const closed: Record<string, unknown> = { opacity: 0 };
    closed[axis] = sign * 100;
    return closed;
  }

  return { opacity: 0 };
}

function generateFramerMotion(specs: AnimationSpec[]): string {
  const lines: string[] = [
    '// Generated by figma-intelligence-layer animation-specifier',
    'import { Variants } from "framer-motion";',
    "",
  ];

  for (const spec of specs) {
    const varName = `${spec.name}Variants`;
    const closedVariant = getClosedVariant(spec);
    const openVariant: Record<string, unknown> = { opacity: 1 };

    // Mirror positional closed values to zero in open
    for (const key of Object.keys(closedVariant)) {
      if (key !== "opacity" && key !== "scale") openVariant[key] = 0;
      if (key === "scale") openVariant[key] = 1;
    }

    let transition: Record<string, unknown>;
    if (spec.isSpring) {
      transition = {
        type: "spring",
        stiffness: spec.springStiffness ?? 300,
        damping: spec.springDamping ?? 30,
      };
    } else {
      transition = {
        duration: spec.duration,
        ease: spec.easingValues,
      };
    }

    lines.push(`export const ${varName}: Variants = {`);
    lines.push(`  closed: ${JSON.stringify(closedVariant)},`);
    lines.push(`  open: {`);
    lines.push(`    ...${JSON.stringify(openVariant)},`);
    lines.push(`    transition: ${JSON.stringify(transition)},`);
    lines.push(`  },`);
    lines.push(`};`);
    lines.push("");

    // Add a helper component usage comment
    lines.push(`// Usage: <motion.div variants={${varName}} initial="closed" animate="open" />`);
    lines.push("");
  }

  return lines.join("\n");
}

function generateCSS(specs: AnimationSpec[]): string {
  const lines: string[] = [
    "/* Generated by figma-intelligence-layer animation-specifier */",
    "",
  ];

  for (const spec of specs) {
    const type = spec.type.toUpperCase();
    const dir = spec.direction.toUpperCase();
    const name = spec.name;
    const durationMs = Math.round(spec.duration * 1000);
    const easingCss = EASING_CSS_MAP[spec.easing] ?? "ease-in-out";

    if (type === "DISSOLVE") {
      lines.push(`@keyframes ${name}FadeIn {`);
      lines.push(`  from { opacity: 0; }`);
      lines.push(`  to   { opacity: 1; }`);
      lines.push(`}`);
      lines.push("");
      lines.push(`.${name} {`);
      lines.push(`  animation: ${name}FadeIn ${durationMs}ms ${easingCss} forwards;`);
      lines.push(`}`);
    } else if (type === "SMART_ANIMATE") {
      lines.push(`@keyframes ${name}Morph {`);
      lines.push(`  from { opacity: 0; transform: scale(0.95); }`);
      lines.push(`  to   { opacity: 1; transform: scale(1); }`);
      lines.push(`}`);
      lines.push("");
      lines.push(`.${name} {`);
      lines.push(`  animation: ${name}Morph ${durationMs}ms ${easingCss} forwards;`);
      lines.push(`}`);
    } else if (
      type === "PUSH" || type === "SLIDE_IN" || type === "SLIDE_OUT" ||
      type === "MOVE_IN" || type === "MOVE_OUT"
    ) {
      const { axis, sign } = getSlideAxis(type, dir);
      const translateFn = axis === "x" ? "translateX" : "translateY";
      const fromVal = `${sign * 100}%`;

      lines.push(`@keyframes ${name}SlideIn {`);
      lines.push(`  from { opacity: 0; transform: ${translateFn}(${fromVal}); }`);
      lines.push(`  to   { opacity: 1; transform: ${translateFn}(0); }`);
      lines.push(`}`);
      lines.push("");
      lines.push(`.${name} {`);
      lines.push(`  animation: ${name}SlideIn ${durationMs}ms ${easingCss} forwards;`);
      lines.push(`}`);
    } else {
      lines.push(`@keyframes ${name} {`);
      lines.push(`  from { opacity: 0; }`);
      lines.push(`  to   { opacity: 1; }`);
      lines.push(`}`);
      lines.push("");
      lines.push(`.${name} {`);
      lines.push(`  animation: ${name} ${durationMs}ms ${easingCss} forwards;`);
      lines.push(`}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function generateSwift(specs: AnimationSpec[]): string {
  const lines: string[] = [
    "// Generated by figma-intelligence-layer animation-specifier",
    "import SwiftUI",
    "import UIKit",
    "",
    "// MARK: - SwiftUI Animations",
    "",
  ];

  for (const spec of specs) {
    const type = spec.type.toUpperCase();
    const dir = spec.direction.toUpperCase();
    const swiftEasing = EASING_SWIFT_MAP[spec.easing] ?? ".easeInOut";
    const durationStr = spec.duration.toFixed(3);
    const name = spec.name;

    lines.push(`// Transition: ${spec.fromId} → ${spec.toId}`);

    if (spec.isSpring) {
      lines.push(`func ${name}Animation(isVisible: Binding<Bool>) -> some View {`);
      lines.push(`  content`);
      lines.push(`    .opacity(isVisible.wrappedValue ? 1 : 0)`);
      lines.push(`    .animation(.spring(response: ${durationStr}, dampingFraction: 0.7), value: isVisible.wrappedValue)`);
      lines.push(`}`);
    } else if (type === "DISSOLVE") {
      lines.push(`func ${name}Animation(isVisible: Binding<Bool>) -> some View {`);
      lines.push(`  content`);
      lines.push(`    .opacity(isVisible.wrappedValue ? 1 : 0)`);
      lines.push(`    .animation(.easeInOut(duration: ${durationStr}), value: isVisible.wrappedValue)`);
      lines.push(`}`);
    } else if (type === "SMART_ANIMATE") {
      lines.push(`func ${name}Animation(isVisible: Binding<Bool>) -> some View {`);
      lines.push(`  content`);
      lines.push(`    .opacity(isVisible.wrappedValue ? 1 : 0)`);
      lines.push(`    .scaleEffect(isVisible.wrappedValue ? 1 : 0.95)`);
      lines.push(`    .animation(${swiftEasing}(duration: ${durationStr}), value: isVisible.wrappedValue)`);
      lines.push(`}`);
    } else if (
      type === "PUSH" || type === "SLIDE_IN" || type === "SLIDE_OUT" ||
      type === "MOVE_IN" || type === "MOVE_OUT"
    ) {
      const isHorizontal = dir === "LEFT" || dir === "RIGHT";
      const offsetEdge = dir === "LEFT" ? "-UIScreen.main.bounds.width"
        : dir === "RIGHT" ? "UIScreen.main.bounds.width"
        : dir === "UP" ? "-UIScreen.main.bounds.height"
        : "UIScreen.main.bounds.height";

      lines.push(`func ${name}Animation(isVisible: Binding<Bool>) -> some View {`);
      if (isHorizontal) {
        lines.push(`  content`);
        lines.push(`    .offset(x: isVisible.wrappedValue ? 0 : ${offsetEdge})`);
        lines.push(`    .opacity(isVisible.wrappedValue ? 1 : 0)`);
        lines.push(`    .animation(${swiftEasing}(duration: ${durationStr}), value: isVisible.wrappedValue)`);
      } else {
        lines.push(`  content`);
        lines.push(`    .offset(y: isVisible.wrappedValue ? 0 : ${offsetEdge})`);
        lines.push(`    .opacity(isVisible.wrappedValue ? 1 : 0)`);
        lines.push(`    .animation(${swiftEasing}(duration: ${durationStr}), value: isVisible.wrappedValue)`);
      }
      lines.push(`}`);
    } else {
      lines.push(`func ${name}Animation(isVisible: Binding<Bool>) -> some View {`);
      lines.push(`  content`);
      lines.push(`    .opacity(isVisible.wrappedValue ? 1 : 0)`);
      lines.push(`    .animation(${swiftEasing}(duration: ${durationStr}), value: isVisible.wrappedValue)`);
      lines.push(`}`);
    }

    lines.push("");

    // UIKit version
    lines.push(`// UIKit equivalent for ${name}`);
    lines.push(`func ${name}UIKitAnimate(view: UIView, isShowing: Bool) {`);
    if (spec.isSpring) {
      lines.push(`  let animator = UIViewPropertyAnimator(duration: ${durationStr}, dampingRatio: 0.7) {`);
      lines.push(`    view.alpha = isShowing ? 1 : 0`);
      lines.push(`    view.transform = isShowing ? .identity : CGAffineTransform(scaleX: 0.95, y: 0.95)`);
      lines.push(`  }`);
    } else {
      lines.push(`  let animator = UIViewPropertyAnimator(duration: ${durationStr}, curve: ${swiftEasing.replace(".", ".")}) {`);
      lines.push(`    view.alpha = isShowing ? 1 : 0`);
      lines.push(`  }`);
    }
    lines.push(`  animator.startAnimation()`);
    lines.push(`}`);
    lines.push("");
  }

  return lines.join("\n");
}

function generateAndroid(specs: AnimationSpec[]): string {
  const lines: string[] = [
    "// Generated by figma-intelligence-layer animation-specifier",
    "// Kotlin — place these in your animation utilities file",
    "",
    "import android.animation.AnimatorSet",
    "import android.animation.ObjectAnimator",
    "import android.view.View",
    "import android.view.animation.AccelerateDecelerateInterpolator",
    "import android.view.animation.AccelerateInterpolator",
    "import android.view.animation.DecelerateInterpolator",
    "import android.view.animation.LinearInterpolator",
    "import androidx.interpolator.view.animation.FastOutSlowInInterpolator",
    "",
    "object FigmaAnimations {",
    "",
  ];

  for (const spec of specs) {
    const type = spec.type.toUpperCase();
    const dir = spec.direction.toUpperCase();
    const durationMs = Math.round(spec.duration * 1000);
    const name = spec.name;

    const interpolatorMap: Record<string, string> = {
      EASE_IN:     "AccelerateInterpolator()",
      EASE_OUT:    "DecelerateInterpolator()",
      EASE_IN_OUT: "FastOutSlowInInterpolator()",
      LINEAR:      "LinearInterpolator()",
      SPRING:      "FastOutSlowInInterpolator()",
    };
    const interpolator = interpolatorMap[spec.easing] ?? "FastOutSlowInInterpolator()";

    lines.push(`    // ${spec.fromId} → ${spec.toId}`);
    lines.push(`    fun ${name}(view: View, isEntering: Boolean) {`);

    if (type === "DISSOLVE") {
      lines.push(`        val alpha = ObjectAnimator.ofFloat(`);
      lines.push(`            view, "alpha", if (isEntering) 0f else 1f, if (isEntering) 1f else 0f`);
      lines.push(`        )`);
      lines.push(`        alpha.duration = ${durationMs}L`);
      lines.push(`        alpha.interpolator = ${interpolator}`);
      lines.push(`        alpha.start()`);
    } else if (type === "SMART_ANIMATE") {
      lines.push(`        val alpha = ObjectAnimator.ofFloat(`);
      lines.push(`            view, "alpha", if (isEntering) 0f else 1f, if (isEntering) 1f else 0f`);
      lines.push(`        )`);
      lines.push(`        val scaleX = ObjectAnimator.ofFloat(`);
      lines.push(`            view, "scaleX", if (isEntering) 0.95f else 1f, if (isEntering) 1f else 0.95f`);
      lines.push(`        )`);
      lines.push(`        val scaleY = ObjectAnimator.ofFloat(`);
      lines.push(`            view, "scaleY", if (isEntering) 0.95f else 1f, if (isEntering) 1f else 0.95f`);
      lines.push(`        )`);
      lines.push(`        val set = AnimatorSet()`);
      lines.push(`        set.playTogether(alpha, scaleX, scaleY)`);
      lines.push(`        set.duration = ${durationMs}L`);
      lines.push(`        set.interpolator = ${interpolator}`);
      lines.push(`        set.start()`);
    } else if (
      type === "PUSH" || type === "SLIDE_IN" || type === "SLIDE_OUT" ||
      type === "MOVE_IN" || type === "MOVE_OUT"
    ) {
      const { axis, sign } = getSlideAxis(type, dir);
      const property = axis === "x" ? "translationX" : "translationY";
      const fromExpr = `if (isEntering) ${sign * 500}f else 0f`;
      const toExpr   = `if (isEntering) 0f else ${sign * 500}f`;

      lines.push(`        val translate = ObjectAnimator.ofFloat(`);
      lines.push(`            view, "${property}", ${fromExpr}, ${toExpr}`);
      lines.push(`        )`);
      lines.push(`        val alpha = ObjectAnimator.ofFloat(`);
      lines.push(`            view, "alpha", if (isEntering) 0f else 1f, if (isEntering) 1f else 0f`);
      lines.push(`        )`);
      lines.push(`        val set = AnimatorSet()`);
      lines.push(`        set.playTogether(translate, alpha)`);
      lines.push(`        set.duration = ${durationMs}L`);
      lines.push(`        set.interpolator = ${interpolator}`);
      lines.push(`        set.start()`);
    } else {
      lines.push(`        val alpha = ObjectAnimator.ofFloat(`);
      lines.push(`            view, "alpha", if (isEntering) 0f else 1f, if (isEntering) 1f else 0f`);
      lines.push(`        )`);
      lines.push(`        alpha.duration = ${durationMs}L`);
      lines.push(`        alpha.interpolator = ${interpolator}`);
      lines.push(`        alpha.start()`);
    }

    lines.push(`    }`);
    lines.push("");

    // XML resource comment
    lines.push(`    /*`);
    lines.push(`     * res/animator/${name.toLowerCase()}.xml`);
    lines.push(`     * <set xmlns:android="http://schemas.android.com/apk/res/android">`);

    if (type === "DISSOLVE") {
      lines.push(`     *   <objectAnimator android:propertyName="alpha"`);
      lines.push(`     *     android:valueFrom="0" android:valueTo="1"`);
      lines.push(`     *     android:duration="${durationMs}" />`);
    } else if (
      type === "PUSH" || type === "SLIDE_IN" || type === "SLIDE_OUT" ||
      type === "MOVE_IN" || type === "MOVE_OUT"
    ) {
      const { axis, sign } = getSlideAxis(type, dir);
      const property = axis === "x" ? "translationX" : "translationY";
      lines.push(`     *   <objectAnimator android:propertyName="${property}"`);
      lines.push(`     *     android:valueFrom="${sign * 500}" android:valueTo="0"`);
      lines.push(`     *     android:duration="${durationMs}" />`);
      lines.push(`     *   <objectAnimator android:propertyName="alpha"`);
      lines.push(`     *     android:valueFrom="0" android:valueTo="1"`);
      lines.push(`     *     android:duration="${durationMs}" />`);
    }

    lines.push(`     * </set>`);
    lines.push(`     */`);
    lines.push("");
  }

  lines.push("}");
  return lines.join("\n");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function animationSpecifierHandler(
  args: AnimationSpecifierArgs
): Promise<AnimationSpecifierResult> {
  const { frameNodeId, outputFormat } = args;

  const bridge = await getBridge();

  // 1. Retrieve all prototype connections
  let rawConnections = await bridge.getPrototypeConnections();

  // 2. Filter to the requested frame if specified
  if (frameNodeId) {
    rawConnections = rawConnections.filter(
      (c) => c.fromId === frameNodeId || c.toId === frameNodeId
    );
  }

  const totalConnections = rawConnections.length;

  // 3. Filter to connections that carry animation data
  const animatedRaw = rawConnections.filter((c) => {
    const transition = (c.action["transition"] as Record<string, unknown> | undefined);
    return transition !== undefined && transition !== null;
  });

  const animatedConnections = animatedRaw.length;

  // 4. Parse into AnimationSpec objects
  const animations = parseConnections(animatedRaw);

  // 5. Generate code in the requested format(s)
  const code: AnimationSpecifierResult["code"] = {};
  const needsAll = outputFormat === "all";

  if (outputFormat === "json" || needsAll) {
    code.json = JSON.stringify(animations, null, 2);
  }

  if (outputFormat === "framer-motion" || needsAll) {
    code.framerMotion = generateFramerMotion(animations);
  }

  if (outputFormat === "css" || needsAll) {
    code.css = generateCSS(animations);
  }

  if (outputFormat === "swift" || needsAll) {
    code.swift = generateSwift(animations);
  }

  if (outputFormat === "android" || needsAll) {
    code.android = generateAndroid(animations);
  }

  // 6. Log the action
  await decisionLog.log({
    tool: "animation-specifier",
    nodeIds: frameNodeId ? [frameNodeId] : animations.map((a) => a.fromId).slice(0, 20),
    rationale: `Extracted ${animatedConnections} animated prototype connections from ${totalConnections} total. Generated ${outputFormat} animation code for ${animations.length} transitions.`,
    reversible: false,
    metadata: {
      frameNodeId,
      outputFormat,
      totalConnections,
      animatedConnections,
      animationCount: animations.length,
    },
  });

  return { animations, code, totalConnections, animatedConnections };
}
