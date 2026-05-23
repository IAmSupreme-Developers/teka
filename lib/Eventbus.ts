export default class Eventbus{
    event: {[index:string]: Array<(...t:any)=>any>}
	constructor(){
		this.event = {};
		// console.log(this)
	}
	/**
	 * 
	 * @param {string} eventName 
	 * @param {Function} callback 
	 */
	subscribe(eventName: string, callback: (...t:any)=>any){
		if (!this.event[eventName]) {
			this.event[eventName] = [];
		}
		this.event[eventName].push(callback);
	}
	
	/**
	 * 
	 * @param {string} eventName 
	 * @param {Function} callback 
	 * @returns 
	 */
	unSubscribe(eventName: string, callback: (...t:any)=>any){
		if (!this.event[eventName]) return;
		this.event[eventName] = this.event[eventName].filter(cb => cb !== callback);
	}

	/**
	 * 
	 * @param {string} eventName 
	 * @param {any} payload 
	 * @returns {void}
	 */
	dispatch(eventName: string, ...payload:any){
		if (!this.event[eventName]) return;
		this.event[eventName].forEach(cb => {
			cb(...payload);
			// console.log(`Event ${eventName} has been dispatched`);
        });
	}
}

// import Eventbus from './Eventbus'

const g = global as typeof global & { _eventbus?: Eventbus }
export const bus = g._eventbus ?? (g._eventbus = new Eventbus())
