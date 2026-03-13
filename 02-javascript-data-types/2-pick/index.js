/**
 * pick - Creates an object composed of the picked object properties:
 * @param {object} obj - the source object
 * @param {...string} fields - the properties paths to pick
 * @returns {object} - returns the new object
 */
export const pick = (main_obj, ...fields) => {
     let obj = {}; 
    for (let i = 0; i < fields.length; i++) {
        obj[fields[i]] = main_obj[fields[i]];
};
return obj;
}