
import {vec3, quat} from 'gl-matrix';

export const GRAVITATIONAL_CONSTANT = 6.674 * Math.pow(10, -11);
// # Terminology
//
// This class uses 'apoapsis' and 'periapsis', the appropriate terms to use
// when the orbiting body is not known.

export default class Orbit {

  constructor() {
    this.eccentricity = 0;

    // Semimajor axis, in meters.
    // We use a semimajor axis value of zero to denote
    // the special case of an object that is fixed in space.
    this.semimajor = 0;

    // All angles are in radians.
    this.inclination = 0;
    this.raan = 0;

    // Argument of periapsis.
    this.argument_of_periapsis = 0;

    // The initial mean anomaly.
    this.initial_anomaly = 0;

    // Number of seconds it takes to complete a full orbit.
    this.period = 1;
  }

  setCircularOrbit(semimajor) {
    this.eccentricity = 0;
    this.semimajor = semimajor;
    return this;
  }

  /*
  // Returns this `Orbit`, but with no eccentricity and the given `semimajor` axis distance.
  public Orbit FromCircularOrbit(double semimajor) {
    this.eccentricity = 0;
    this.semimajor = semimajor;
    return this;
  }

  // Returns this `Orbit`, but with `eccentricity` and `periapsis` set.
  public Orbit FromPeriapsisOfEccentricOrbit(double eccentricity, double periapsis) {
    this.eccentricity = eccentricity;
    this.semimajor = periapsis * (1 + eccentricity);
    return this;
  }

  public Orbit FromApoapsisOfEccentricOrbit(double eccentricity, double apoapsis) {
    this.eccentricity = eccentricity;
    this.semimajor = apoapsis * (1 - eccentricity);
    return this;
  }
*/

  // Sets the orbital period, in seconds.
  setPeriod(period) {
    this.period = period;

    return this;
  }

  // Sets the orbital period, in seconds, for the given mass.
  // If the orbit doesn't have a period, doesn't change the period.
  setPeriodFromMass(mass) {
    // Hyperbolic orbits don't have a period.
    if(this.eccentricity > 1) {
      return;
    }
    
    this.period = 2 * Math.PI * Math.sqrt(Math.pow(this.semimajor, 3) / (GRAVITATIONAL_CONSTANT * mass));

    console.log(this.period / 60 / 60 / 24 / 365);

    return this;
  }

  // Returns the periapsis of this orbit in meters above the focus of the ellipse.
  getPeriapsis() {
    return this.semimajor * (1 - this.eccentricity);
  }
  
  // Returns the apoapsis of this orbit in meters above the focus of the ellipse.
  getApoapsis() {
    return this.semimajor * (1 + this.eccentricity);
  }

  // Given a `meanAnomaly` in radians, returns the eccentric anomaly.
  // Huge thanks to Jürgen Giesen's awesome website at http://www.jgiesen.de/kepler/kepler.html
  // with the interactive eccentric anomaly calculator.
  getEccentricAnomalyAtMeanAnomaly(mean_anomaly) {
    let places = 4;
    let max_iterations = 30;
    let i = 0;

    let delta = Math.pow(10, -places);

    let E, F;
    
    mean_anomaly = ((mean_anomaly / (Math.PI * 2)) % 1) * (Math.PI * 2);

    if(this.eccentricity < 0.8) {
      E = mean_anomaly;
    } else {
      E = Math.PI;
    }

    F = E - this.eccentricity * Math.sin(mean_anomaly) - mean_anomaly;

    while((Math.abs(F) > delta) && (i < max_iterations)) {
      E = E - F / (1.0 - (this.eccentricity * Math.cos(E)));
      F = E - (this.eccentricity * Math.sin(E)) - mean_anomaly;

      i += 1;
    }

    return E;
  }

  // Returns the true anomaly for the given mean anomaly.
  getTrueAnomalyAtMeanAnomaly(mean_anomaly) {
    let eccentric_anomaly = this.getEccentricAnomalyAtMeanAnomaly(mean_anomaly);

    return 2 * Math.atan2(Math.sqrt(1 + this.eccentricity), 1 - this.eccentricity) * Math.tan(eccentric_anomaly / 2);
  }

  getRadiusAtTrueAnomaly(true_anomaly) {
    return this.semimajor * ((1 - Math.pow(this.eccentricity, 2)) / (1 + (this.eccentricity * Math.cos(true_anomaly))));
  }

  // Given a true anomaly in radians, returns the position of the body at that point.
  getPositionAtTrueAnomaly(true_anomaly) {
    let radius = this.getRadiusAtTrueAnomaly(true_anomaly);

    // This is the position, along the X-Z plane.
    // We need to ruin the precision here because Unity is really stupid and has decided to
    // not include double precision multiplications against quaternions.
    let position = vec3.fromValues(Math.sin(true_anomaly * (Math.PI * 2)) * radius, 0, Math.cos(true_anomaly * (Math.PI * 2)) * radius);

    /*
    position = math.mul(Unity.Mathematics.quaternion.RotateY((float) -this.argument_of_periapsis), position);
    position = math.mul(Unity.Mathematics.quaternion.RotateX((float) -this.inclination), position);
    position = math.mul(Unity.Mathematics.quaternion.RotateY((float) -this.raan), position);
    */
    
    return position;
  }

  // Given a mean anomaly in radians, returns the position of the body at that point.
  getPositionAtMeanAnomaly(mean_anomaly) {
    let true_anomaly = this.getTrueAnomalyAtMeanAnomaly(this.initial_anomaly + mean_anomaly);

    return this.getPositionAtTrueAnomaly(true_anomaly);
  }

  getPositionAtTime(time) {
    return this.getPositionAtMeanAnomaly((time / this.period) * Math.PI * 2);
  }

  getVelocityAtTime(time) {
    return vec3.fromValues(0, 0, 0);
  }

}
