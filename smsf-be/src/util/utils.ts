/* eslint-disable no-useless-escape */
import moment from 'moment-timezone';
import * as _ from 'lodash';
const Decimal = require('decimal.js');

export const UNIT_OF_TIME = {
    DATE: 'date',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
};

export const UNIT_TIME_MOMENT_FORMAT_MAP = {
    [UNIT_OF_TIME.DATE]: {
        ADD: 'days',
        OUTPUT: 'YYYYMMDD',
    },
    [UNIT_OF_TIME.WEEK]: {
        ADD: 'weeks',
        OUTPUT: 'YYYYWW',
    },
    [UNIT_OF_TIME.MONTH]: {
        ADD: 'months',
        OUTPUT: 'YYYYMM',
    },
    [UNIT_OF_TIME.YEAR]: {
        ADD: 'year',
        OUTPUT: 'YYYY',
    },
};

export const TIME_FRAME_FORMAT = {
    NONE: 'NONE',
    DAY: 'YYYYMMDD',
    WEEK: 'YYYYWW',
    MONTH: 'YYYYMM',
    YEAR: 'YYYY',
};

export function delay(timeout) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}

export function getAvoidFalsy(data: any, path: string, defaultVal?: any) {
    return _.get(data, path, defaultVal) || defaultVal;
}

export function buildIndexName(indexPrefix, timestamp, timeFormat) {
    const date = moment(timestamp).tz('Asia/Ho_Chi_Minh');
    if (timeFormat === UNIT_TIME_MOMENT_FORMAT_MAP[UNIT_OF_TIME.WEEK].OUTPUT && date.format('MM') === '01' && date.format('WW') > '05') {
        const dateOutputFormat = timeFormat.replace('WW', '00');
        return `${indexPrefix}${date.format(dateOutputFormat)}`;
    } else if (timeFormat === UNIT_TIME_MOMENT_FORMAT_MAP[UNIT_OF_TIME.WEEK].OUTPUT && date.format('MM') === '12' && date.format('WW') === '01') {
        const nextYear = parseInt(date.format('YYYY')) + 1;
        const adjustedFormat = timeFormat.replace('YYYY', nextYear.toString()).replace('WW', '01');
        return `${indexPrefix}${date.format(adjustedFormat)}`;
    } 
     
    return `${indexPrefix}${date.format(timeFormat)}`;
}

export function numberWithCommas(x): string {
    if (!x) {
        return x;
    }

    return parseInt(x, 10)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Remove nested property from obj
 * @author TriLe
 * @param obj
 * @param omitProperty
 * @returns
 */

export function deepOmit(obj: any, omitProperties: any[]) {
    const objResult = obj;
    if (!_.isEmpty(omitProperties)) {
        _.forEach(omitProperties, (property) => {
            // check obj arr omit
            if (!_.isEmpty(property) && Array.isArray(property)) {
                const key = _.head(property) || '';
                const restSubProp = _.tail(property);
                if (!_.isEmpty(objResult[key])) {
                    objResult[key] = objResult[key].map((subObj) => {
                        return deepOmit(subObj, restSubProp);
                    });
                }
            } else {
                _.unset(objResult, property);
            }
        });
    }

    return objResult;
}

/**
 * Get value of a key in object
 *
 * Example:
 *   cont obj = { key: 'value' };  getValueField(obj, ['key']); // output: value
 *   cont obj = { nested: { key: 'value' } };  getValueField(obj, ['nested', 'key']); // output: value
 *
 * @author Rampo
 * @param obj
 * @param fieldPath {Array of string}
 */
export function getValueField(obj, fieldPath = []) {
    const originObj = obj;
    let i = 0;
    while (i < fieldPath.length - 1 && obj) {
        obj = obj[fieldPath[i++]];
    }
    if (obj) {
        return obj[fieldPath[fieldPath.length - 1]];
    }
    console.error(`Cannnot find ${fieldPath.join('/')} in obj: ${JSON.stringify(originObj)}`);
    return null;
}

/**
 * Remove Vietnamese tones
 *
 * @author Rampo
 * @param string
 */
export function removeVietnameseTones(strOrigin: string): string {
    let str = strOrigin || '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
    str = str.replace(/Đ/g, 'D');
    // Some system encode vietnamese combining accent as individual utf-8 characters
    // Một vài bộ encode coi các dấu mũ, dấu chữ như một kí tự riêng biệt nên thêm hai dòng này
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ''); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
    str = str.replace(/\u02C6|\u0306|\u031B/g, ''); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư

    // Remove punctuations
    // Bỏ dấu câu, kí tự đặc biệt
    str = str.replace(/!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g, ' ');

    // Remove extra spaces
    // Bỏ các khoảng trắng liền nhau
    str = str.replace(/ + /g, ' ');
    str = str.trim();

    return str.toLowerCase();
}

/**
 * Calculate number javascript
 *
 * @author Rampo
 * @param minusNumber: number, 
 * @param subtrahend: number, 
 * @param  growthValue = GROWTH_VALUE_DEFAULT(10000)
 */
// js issue: 5-3.2 = 1.7999999998  
// need result 5-3.2 = 1.8
// solution * with a GROWTH_VALUE_DEFAULT default 10000
// ex: (5*10000 - 3.2*10000)/10000 = 1.8;
const GROWTH_VALUE_DEFAULT = 10000;
export function subtractionNumberExactly(minusNumber: number, subtrahend: number, growthValue = GROWTH_VALUE_DEFAULT): number {
    return ((minusNumber* growthValue) - (subtrahend * growthValue))/growthValue;
}

/**
 * Calculate number javascript
 *
 * @author Rampo
 * @param minusNumber: number, 
 * @param subtrahend: number, 
 */
// js issue: 5-3.2 = 1.7999999998  
// need result 5-3.2 = 1.8
export function minusNumberWithDecimal(minusNumber, subtrahend) {
    try {
        // check is Number
        if (typeof minusNumber !== 'number' || typeof subtrahend !== 'number') {
            return minusNumber - subtrahend;
        }
        return new Decimal(minusNumber).minus(subtrahend).toNumber();
    } catch (error) {
        return minusNumber - subtrahend;
    }
}
  
/**
   * Calculate number javascript
   *
   * @author Rampo
   * @param number1: number, 
   * @param number2: number, 
*/
export function addNumberWithDecimal(number1, number2){
    try {
        // check is Number
        if (typeof number1 !== 'number' || typeof number2 !== 'number') {
            return number1 + number2;
        }
        return new Decimal(number1).plus(number2).toNumber();
    } catch (error) {
        return number1 + number2;
    }
}

/**
 * Nhân 2 số với nhau
 * */ 
export function multiplyNumberWithDecimal(number1, number2){
    try {
        // check is Number
        if (typeof number1 !== 'number' || typeof number2 !== 'number') {
            return number1 * number2;
        }
        return new Decimal(number1).mul(number2).toNumber();
    } catch (error) {
        return number1 * number2;
    }
}

import Crypto from 'crypto';

export function md5(text: string){
    return Crypto.createHash('md5').update(text).digest('hex');
}
