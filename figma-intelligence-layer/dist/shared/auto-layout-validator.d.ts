/**
 * Returns a JavaScript function definition string for `validateAutoLayout(root)`.
 * This function is meant to be inlined into a bridge.execute() script.
 * It performs a depth-first walk of the node tree and repairs invalid
 * auto-layout sizing combinations.
 */
export declare function generateValidatorScript(): string;
/**
 * Returns a JS statement that invokes the validator on the given variable.
 * Must be used after `generateValidatorScript()` has been inlined.
 */
export declare function generateValidatorCall(varName: string): string;
/**
 * Generates a document-specific repair pass that fixes structural layout issues.
 * This should be called AFTER the main validator pass.
 * Returns a JS function definition for `repairDocumentLayout(root)`.
 */
export declare function generateDocumentRepairScript(): string;
/**
 * Returns a JS statement that invokes the document repair pass.
 * Must be used after `generateDocumentRepairScript()` has been inlined.
 */
export declare function generateDocumentRepairCall(varName: string): string;
//# sourceMappingURL=auto-layout-validator.d.ts.map