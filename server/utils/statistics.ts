/**
 * Statistical Analysis Utilities
 *
 * A/B testing statistical analysis functions including:
 * - Welch's t-test for comparing two groups
 * - Confidence interval calculation
 * - Effect size (Cohen's d)
 * - Sample size requirements
 */

// ============================================
// Types
// ============================================

export interface TTestResult {
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  isSignificant: boolean;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  mean: number;
  marginOfError: number;
}

export interface StatisticalAnalysis {
  tTest: TTestResult | null;
  confidenceInterval: ConfidenceInterval | null;
  effectSize: number | null;
  sampleSizeAdequate: boolean;
  requiredSampleSize: number;
  currentSampleSize: number;
  warnings: string[];
}

// ============================================
// Basic Statistics
// ============================================

/**
 * Calculate mean of an array
 */
export function mean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, val) => sum + val, 0) / data.length;
}

/**
 * Calculate variance of an array
 */
export function variance(data: number[], isSample: boolean = true): number {
  if (data.length < 2) return 0;
  const avg = mean(data);
  const squaredDiffs = data.map(val => Math.pow(val - avg, 2));
  const divisor = isSample ? data.length - 1 : data.length;
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / divisor;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(data: number[], isSample: boolean = true): number {
  return Math.sqrt(variance(data, isSample));
}

/**
 * Calculate standard error of the mean
 */
export function standardError(data: number[]): number {
  if (data.length === 0) return 0;
  return standardDeviation(data) / Math.sqrt(data.length);
}

// ============================================
// T-Test (Welch's t-test)
// ============================================

/**
 * Perform Welch's t-test for two independent samples
 * This is more robust than Student's t-test when variances are unequal
 */
export function welchTTest(group1: number[], group2: number[]): TTestResult | null {
  if (group1.length < 2 || group2.length < 2) {
    return null;
  }

  const n1 = group1.length;
  const n2 = group2.length;
  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const var1 = variance(group1);
  const var2 = variance(group2);

  // Welch's t-statistic
  const se1 = var1 / n1;
  const se2 = var2 / n2;
  const seSum = se1 + se2;

  if (seSum === 0) {
    return null;
  }

  const tStatistic = (mean1 - mean2) / Math.sqrt(seSum);

  // Welch-Satterthwaite degrees of freedom
  const numerator = Math.pow(seSum, 2);
  const denominator = (Math.pow(se1, 2) / (n1 - 1)) + (Math.pow(se2, 2) / (n2 - 1));
  const degreesOfFreedom = numerator / denominator;

  // Calculate p-value using t-distribution approximation
  const pValue = tDistributionPValue(Math.abs(tStatistic), degreesOfFreedom);

  return {
    tStatistic,
    degreesOfFreedom,
    pValue,
    isSignificant: pValue < 0.05
  };
}

/**
 * Approximate p-value for t-distribution (two-tailed)
 * Uses a simple approximation suitable for most practical cases
 */
function tDistributionPValue(t: number, df: number): number {
  // Use normal approximation for large df
  if (df > 100) {
    return 2 * (1 - normalCDF(t));
  }

  // For smaller df, use a more accurate approximation
  const x = df / (df + t * t);
  const beta = incompleteBeta(df / 2, 0.5, x);
  return beta;
}

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Incomplete beta function approximation
 */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Use continued fraction approximation
  const maxIterations = 100;
  const epsilon = 1e-10;

  const bt = Math.exp(
    gammaLn(a + b) - gammaLn(a) - gammaLn(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );

  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaContinuedFraction(a, b, x) / a;
  } else {
    return 1 - bt * betaContinuedFraction(b, a, 1 - x) / b;
  }
}

/**
 * Beta continued fraction
 */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 100;
  const epsilon = 1e-10;

  let m = 1;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;

  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let i = 1; i <= maxIterations; i++) {
    const m2 = 2 * i;
    let aa = i * (b - i) * x / ((qam + m2) * (a + m2));

    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    aa = -(a + i) * (qab + i) * x / ((a + m2) * (qap + m2));

    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }

  return h;
}

/**
 * Log gamma function approximation (Stirling)
 */
function gammaLn(x: number): number {
  const coefficients = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);

  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    ser += coefficients[j] / ++y;
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ============================================
// Confidence Interval
// ============================================

/**
 * Calculate confidence interval for a sample mean
 * @param data Sample data
 * @param confidenceLevel Confidence level (default 0.95 for 95%)
 */
export function confidenceInterval(
  data: number[],
  confidenceLevel: number = 0.95
): ConfidenceInterval | null {
  if (data.length < 2) return null;

  const sampleMean = mean(data);
  const se = standardError(data);
  const df = data.length - 1;

  // Get t-critical value for the confidence level
  const alpha = 1 - confidenceLevel;
  const tCritical = getTCritical(df, alpha);

  const marginOfError = tCritical * se;

  return {
    mean: sampleMean,
    lower: sampleMean - marginOfError,
    upper: sampleMean + marginOfError,
    marginOfError
  };
}

/**
 * Get t-critical value for given degrees of freedom and alpha
 * Uses approximation for common confidence levels
 */
function getTCritical(df: number, alpha: number): number {
  // Common t-critical values approximation
  // For two-tailed test at common alpha levels
  if (alpha <= 0.01) {
    // 99% confidence
    if (df >= 120) return 2.576;
    if (df >= 60) return 2.660;
    if (df >= 30) return 2.750;
    if (df >= 10) return 3.169;
    return 3.5;
  } else if (alpha <= 0.05) {
    // 95% confidence
    if (df >= 120) return 1.960;
    if (df >= 60) return 2.000;
    if (df >= 30) return 2.042;
    if (df >= 10) return 2.228;
    return 2.5;
  } else {
    // 90% confidence
    if (df >= 120) return 1.645;
    if (df >= 60) return 1.671;
    if (df >= 30) return 1.697;
    if (df >= 10) return 1.812;
    return 2.0;
  }
}

// ============================================
// Effect Size
// ============================================

/**
 * Calculate Cohen's d effect size
 * @param group1 First group data
 * @param group2 Second group data
 * @returns Cohen's d value
 */
export function cohensD(group1: number[], group2: number[]): number | null {
  if (group1.length < 2 || group2.length < 2) return null;

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const var1 = variance(group1);
  const var2 = variance(group2);
  const n1 = group1.length;
  const n2 = group2.length;

  // Pooled standard deviation
  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const pooledStd = Math.sqrt(pooledVar);

  if (pooledStd === 0) return null;

  return (mean1 - mean2) / pooledStd;
}

/**
 * Interpret Cohen's d effect size
 */
export function interpretEffectSize(d: number | null): string {
  if (d === null) return "計算不能";
  const absD = Math.abs(d);
  if (absD < 0.2) return "非常に小さい";
  if (absD < 0.5) return "小さい";
  if (absD < 0.8) return "中程度";
  return "大きい";
}

// ============================================
// Sample Size
// ============================================

/**
 * Calculate required sample size per group for detecting a given effect size
 * @param effectSize Expected effect size (Cohen's d)
 * @param power Statistical power (default 0.8)
 * @param alpha Significance level (default 0.05)
 */
export function requiredSampleSize(
  effectSize: number = 0.5,
  power: number = 0.8,
  alpha: number = 0.05
): number {
  // Z-values for common power and alpha levels
  const zAlpha = alpha === 0.01 ? 2.576 : alpha === 0.05 ? 1.96 : 1.645;
  const zBeta = power === 0.9 ? 1.28 : power === 0.8 ? 0.84 : 0.52;

  // Sample size formula: n = 2 * ((z_alpha + z_beta) / d)^2
  const n = 2 * Math.pow((zAlpha + zBeta) / Math.abs(effectSize), 2);

  return Math.ceil(n);
}

/**
 * Check if current sample size is adequate
 */
export function isSampleSizeAdequate(
  currentSize: number,
  effectSize: number = 0.5,
  power: number = 0.8,
  alpha: number = 0.05
): boolean {
  const required = requiredSampleSize(effectSize, power, alpha);
  return currentSize >= required;
}

// ============================================
// Two-Proportion Z-Test (for engagement rate comparison)
// ============================================

export interface ProportionTestResult {
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  confidenceLevel: number;
  confidenceInterval: { lower: number; upper: number };
  relativeImprovement: number;
  chiSquare: number;
}

/**
 * Two-proportion Z-test for comparing engagement rates
 *
 * @param successA - Engagements for variant A
 * @param totalA - Total impressions for variant A
 * @param successB - Engagements for variant B
 * @param totalB - Total impressions for variant B
 * @param alpha - Significance level (default 0.05)
 */
export function twoProportionZTest(
  successA: number,
  totalA: number,
  successB: number,
  totalB: number,
  alpha: number = 0.05
): ProportionTestResult {
  const pA = totalA > 0 ? successA / totalA : 0;
  const pB = totalB > 0 ? successB / totalB : 0;

  const pPool = (totalA + totalB) > 0
    ? (successA + successB) / (totalA + totalB)
    : 0;

  const se = Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(totalA, 1) + 1 / Math.max(totalB, 1)));
  const zScore = se > 0 ? (pB - pA) / se : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  const diff = pB - pA;
  const seDiff = Math.sqrt(
    (pA * (1 - pA)) / Math.max(totalA, 1) +
    (pB * (1 - pB)) / Math.max(totalB, 1)
  );
  const zCritical = 1.96;

  return {
    zScore,
    pValue,
    isSignificant: pValue < alpha,
    confidenceLevel: (1 - pValue) * 100,
    confidenceInterval: {
      lower: diff - zCritical * seDiff,
      upper: diff + zCritical * seDiff,
    },
    relativeImprovement: pA > 0 ? ((pB - pA) / pA) * 100 : 0,
    chiSquare: zScore * zScore,
  };
}

/**
 * Analyze A/B test with multiple variations against a control
 */
export function analyzeMultiVariation(
  variations: Array<{ name: string; successes: number; total: number }>,
  alpha: number = 0.05
): Array<{ name: string; rate: number; vsControl: ProportionTestResult | null }> {
  if (variations.length < 2) return [];
  const control = variations[0];
  return variations.map((v, i) => ({
    name: v.name,
    rate: v.total > 0 ? v.successes / v.total : 0,
    vsControl: i === 0 ? null : twoProportionZTest(control.successes, control.total, v.successes, v.total, alpha),
  }));
}

/**
 * Calculate minimum sample size needed per group for proportion test
 */
export function calculateProportionSampleSize(
  baselineRate: number,
  minimumDetectableEffect: number,
  alpha: number = 0.05,
  power: number = 0.8
): number {
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + minimumDetectableEffect);
  const zAlpha = 1.96;
  const zBeta = 0.842;

  const numerator = Math.pow(
    zAlpha * Math.sqrt(2 * p1 * (1 - p1)) +
    zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2
  );
  const denominator = Math.pow(p2 - p1, 2);
  return denominator > 0 ? Math.ceil(numerator / denominator) : Infinity;
}

// ============================================
// Complete Analysis
// ============================================

/**
 * Perform complete statistical analysis for A/B test
 */
export function performStatisticalAnalysis(
  group1: number[],
  group2: number[],
  minSampleSize: number = 30
): StatisticalAnalysis {
  const warnings: string[] = [];
  const currentSampleSize = Math.min(group1.length, group2.length);

  // Check sample size
  if (currentSampleSize < minSampleSize) {
    warnings.push(`サンプルサイズが不足しています（現在: ${currentSampleSize}, 推奨: ${minSampleSize}以上）`);
  }

  // Calculate effect size first for sample size requirement
  const effectSizeValue = cohensD(group1, group2);
  const expectedEffectSize = effectSizeValue !== null ? Math.abs(effectSizeValue) : 0.5;

  // Calculate required sample size
  const required = requiredSampleSize(expectedEffectSize);

  // Perform t-test
  const tTestResult = welchTTest(group1, group2);
  if (!tTestResult) {
    warnings.push("t検定を実行するには各グループに2つ以上のデータが必要です");
  }

  // Calculate confidence intervals
  const ci1 = confidenceInterval(group1);
  const ci2 = confidenceInterval(group2);

  // Use difference of means for confidence interval
  let combinedCI: ConfidenceInterval | null = null;
  if (group1.length >= 2 && group2.length >= 2) {
    const diffMean = mean(group1) - mean(group2);
    const seDiff = Math.sqrt(
      variance(group1) / group1.length + variance(group2) / group2.length
    );
    const df = Math.min(group1.length - 1, group2.length - 1);
    const tCrit = getTCritical(df, 0.05);
    const moe = tCrit * seDiff;
    combinedCI = {
      mean: diffMean,
      lower: diffMean - moe,
      upper: diffMean + moe,
      marginOfError: moe
    };
  }

  // Additional warnings
  if (tTestResult && !tTestResult.isSignificant) {
    warnings.push("結果は統計的に有意ではありません（p ≥ 0.05）");
  }

  if (effectSizeValue !== null && Math.abs(effectSizeValue) < 0.2) {
    warnings.push("効果量が非常に小さいです");
  }

  return {
    tTest: tTestResult,
    confidenceInterval: combinedCI,
    effectSize: effectSizeValue,
    sampleSizeAdequate: currentSampleSize >= required,
    requiredSampleSize: required,
    currentSampleSize,
    warnings
  };
}
