
export const MASS = {
  KILOGRAM: 1,
  
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

LENGTH._UNITS = [
  [LENGTH.METER, 'm'],
  [LENGTH.KM, 'km'],
  [LENGTH.AU, 'AU'],
];

export const TIME = {
  SECOND: 1,
  
  MINUTE: 60,
  HOUR: 60 * 60,
  DAY: 60 * 60 * 24,
  
  MONTH: 60 * 60 * 24 * 30,
  
  YEAR: 60 * 60 * 24 * 365,
};

export function formatTime(time) {
  let seconds = time % TIME.SECOND;
  let minutes = Math.floor((time / TIME.MINUTE) % 60);
  let hours = Math.floor((time / TIME.HOUR) % 24);
  let days = Math.floor((time / TIME.DAY) % 365);
  let years = Math.floor((time / TIME.YEAR));

  let fmt = (v, digits) => {
    return v.toString().padStart(digits, '0');
  };
  
  let value = `${time.toFixed(2)}s`;

  if(time > TIME.MINUTE * 1) {
    value = `${fmt(minutes, 2)}m ${seconds.toFixed(2)}s`;
  }
  
  if(time > TIME.HOUR * 1) {
    value = `${fmt(hours, 2)}h ${value}`;
  }
  
  if(time > TIME.DAY * 1) {
    value = `${fmt(days, 2)}d ${value}`;
  }
  
  if(time > TIME.YEAR * 1) {
    value = `${fmt(years, 2)}y ${value}`;
  }

  return value;
}

export function format(units, value) {

  if(units === TIME) {
    return formatTime(value);
  }

  let unit_value = value;
  let factor, suffix;
  
  for(let i=units._UNITS.length-1; i>=0; i--) {
    factor = units._UNITS[i][0];
    suffix = units._UNITS[i][1];
    
    unit_value = value / factor;

    if(unit_value > 1.5) {
      break;
    }
  }

  return `${unit_value.toLocaleString({maximumFractionDigits: 3})} ${suffix}`;
}
