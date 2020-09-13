
import {vec3} from 'gl-matrix';
import Orbit from './orbit.js';

export default class Body {

  constructor(name) {
    this.name = name;
    
    this.system = null;

    this.position = vec3.create();

    this.radius = 0;
    
    this.orbit = new Orbit(name);

    this.parent = null;

    this.moons = [];
  }

  add(body) {
    this.moons.push(body);

    body._setParent(this);

    this.system._addBody(body);
  }

  _setParent(parent) {
    this.parent = parent;
    this.system = parent.system;
  }

  setRadius(radius) {
    this.radius = radius;

    return this;
  }

  setOrbit(orbit) {
    this.orbit = orbit;

    return this;
  }

  update() {
    vec3.copy(this.position, this.orbit.getPositionAtTime(Date.now() / 1000));
    
    this.moons.forEach((moon) => {
      moon.update();
    });
  }
  
}
