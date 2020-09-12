
export const MASS = {
  KG: 1,
  METRIC_TON: 1000,
  
  EARTH: 5.9736 * Math.pow(10, 24),
  
  SUN: 1.98847 * Math.pow(10, 30)
};

export const THOUSAND = 1000;
export const MILLION = 1000000;
export const BILLION = 1000000000;

export const LENGTH = {
  METER: 1,
  
  KILOMETER: 1000,
  KM: 1000,

  AU: 149.6 * MILLION * 1000
};

const LENGTH_UNITS = [
  [LENGTH.METER, 'm'],
  [LENGTH.KM, 'km'],
  [LENGTH.AU, 'AU'],
];

// let urmom_radius = 150 * LENGTH.AU;

// 1.38 AU
// 1499 km
export function formatLength(value) {

  let unit_value = value;
  let factor, suffix;
  
  for(let i=LENGTH_UNITS.length-1; i>=0; i--) {
    factor = LENGTH_UNITS[i][0];
    suffix = LENGTH_UNITS[i][1];
    
    unit_value = value / factor;

    if(unit_value > 1.5) {
      break;
    }
  }

  return `${unit_value.toLocaleString({maximumFractionDigits: 3})} ${suffix}`;
}
