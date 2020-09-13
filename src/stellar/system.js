
import Logger from 'js-logger';

import Orbit from './orbit.js';
import StellarObject, {StellarObjectStar, StellarObjectPlanet} from './object.js';

import {MILLION, LENGTH, MASS, TIME} from './units.js';

export default class StellarSystem {

  constructor() {
    this.root = new StellarObject('@root');

    this.root.system = this;

    this.objects = {};

    this.init();
  }

  init() {
    this.root.addToSystem(this);
  }

  // Adds the object to this list of objects. Used for fast lookup.
  _addObject(object) {
    if(object.name in this.objects) {
      Logger.warn(`This stellar system already has a object named '${object.name}'!`);
      return;
    }

    this.objects[object.name] = object;
  }

  getObject(name) {
    return this.objects[name];
  }

  hasObject(name) {
    return name in this.objects;
  }

  update() {
    this.root.update();
  }
  
}

export class SolarSystem extends StellarSystem {

  constructor() {
    super();
  }

  init() {
    let sol = new StellarObjectStar('star/sol')
        .setRadius(1.3927 * MILLION * LENGTH.KILOMETER * 0.5);
    
    this.root.add(sol);
    
    let earth = new StellarObjectPlanet('planet/earth')
        .setRadius(6371 * LENGTH.KILOMETER)
        .setRenderInfo({
          textures: {
            color: 'static/stellar/bodies/earth/color-{id}.jpg',
            landinfo: 'static/stellar/bodies/earth/landinfo-{id}.jpg',
            normal: 'static/stellar/bodies/earth/normal-{id}.jpg',
          },
      
          atmosphere: true,
        })
        .setOrbit(new Orbit()
                  .setCircularOrbit(149598023 * LENGTH.KILOMETER - 500 * LENGTH.KILOMETER)
                  .setPeriodFromMass(5.9743 * Math.pow(10, 24) * MASS.KILOGRAM + 1.98847 * Math.pow(10, 30) * MASS.KILOGRAM)
                 );
    
    let moon = new StellarObjectPlanet('planet/earth/moon')
        .setRadius(1737.4 * LENGTH.KILOMETER)
        .setRenderInfo({
          textures: {
            color: 'static/stellar/bodies/moon/color-{id}.jpg',
            normal: 'static/stellar/bodies/moon/normal-{id}.jpg',
          },
        })
        .setOrbit(new Orbit()
                  .setCircularOrbit(384748 * LENGTH.KILOMETER)
                  .setPeriod(27.322 * TIME.DAY)
                 );

    earth.add(moon);
    sol.add(earth);

    super.init();
  }
  
}
