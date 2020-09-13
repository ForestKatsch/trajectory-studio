
//import Logger from 'js-logger';

export class Transition {

  constructor(value, duration) {
    this.value = value;

    this.duration = duration;

    // The time this transition started, in seconds.
    this.start_time = Date.now() / 1000;

    this.fraction = 0;

    // Linearly interpolates from 0..1 over `duration`.
    this.influence = 0;
  }

  update() {
    this.fraction = (Date.now() / 1000 - this.start_time) / this.duration;
    this.fraction = Math.min(Math.max(this.fraction, 0), 1);

    this.influence = this.powerCurve(this.fraction, 4);

  }

  powerCurve(value, sharpness) {
    if(value < 0.5) {
      return Math.pow((value * 2.0), sharpness) * 0.5;
    } else {
      return 1 - (Math.pow((1 - value) * 2.0, sharpness) * 0.5);
    }
  }
  
}

export default class TransitionManager {

  // A `TransitionManager` stores one type of data on a transition stack.
  // When a new transition is pushed, it's automatically blended to.
  constructor(initial_value, interpolator) {
    this.transitions = [];

    this.initial_value = initial_value;
    
    // The interpolator is called with three arguments: `from`, `to`, and a value from 0 to 1.
    // It returns a value that's interpolated linearly from `from` to `to`.
    this.interpolator = interpolator;
  }

  push(transition) {
    this.transitions.push(transition);
  }

  getCurrentInfluence() {
    return this.transitions.length > 0 ? this.transitions[this.transitions.length-1].influence : 1;
  }

  getCurrentFraction() {
    return this.transitions.length > 0 ? this.transitions[this.transitions.length-1].fraction : 1;
  }

  // Returns a value of the type returned by `interpolator`.
  getValue() {
    this.cullInvisibleTransitions();
    
    if(this.transitions.length === 0) {
      return this.initial_value;
    }

    //Logger.debug(`Transition influences: ${this.transitions.map((transition) => transition.influence.toString()).join(', ')}`);
    
    return this.transitions.reduce((value, transition) => {
      transition.update();
      return this.interpolator(value, transition.value, transition.influence);
    }, this.initial_value);
  }

  // Removes every child before the last transition with an influence of `1` (because every transition before that one would be covered
  // up anyway.)
  cullInvisibleTransitions() {
    let first_opaque_transition_index = -1;
    for(let i=0; i<this.transitions.length; i++) {
      if(this.transitions[i].influence >= 0.9999999) {
        first_opaque_transition_index = i;
      }
    }

    if(first_opaque_transition_index > 0) {
      this.transitions.splice(0, first_opaque_transition_index);
    }
  }
  
}
