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
export declare function generateFramerMotion(specs: AnimationSpec[]): string;
//# sourceMappingURL=framer-motion.d.ts.map