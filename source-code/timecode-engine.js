/**
 * TimeCodeForge Pro - CCSDS 301.0-B-4 Time Code & Epoch Engine
 * Implements CUC, CDS, ASCII Level A/B, and Multi-Scale Time Synchronizer.
 * Standard: CCSDS 301.0-B-4 (Blue Book, November 2010) / ISO 11104
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimeCodeEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Epoch definitions
  // CCSDS Epoch: 1958-01-01 00:00:00 TAI
  // Unix Epoch: 1970-01-01 00:00:00 UTC
  // Difference between 1958-01-01 and 1970-01-01 is 4383 days = 378691200 seconds
  const CCSDS_TO_UNIX_OFFSET_SEC = 378691200; // 1970 - 1958 in seconds
  const TAI_MINUS_UTC_2026 = 37; // Standard leap second offset in 2026
  const TAI_MINUS_GPS = 19;     // GPS is constant offset from TAI
  const TT_MINUS_TAI = 32.184;  // TT = TAI + 32.184s

  class TimeCodeEngine {
    constructor() {
      this.version = "1.0.0";
      this.standard = "CCSDS 301.0-B-4 / ISO 11104";
    }

    /**
     * Converts a Date or ISO-8601 string to CCSDS CUC (Unsegmented Time Code)
     * @param {Date|string|number} inputTime - Date or ISO string
     * @param {Object} options - { coarseOctets: 4, fineOctets: 3, agencyEpoch: false }
     * @returns {Object} { pField: Uint8Array, tField: Uint8Array, hex: string, coarseSec: number, fineFraction: number }
     */
    encodeCUC(inputTime, options = {}) {
      const coarseOctets = options.coarseOctets !== undefined ? options.coarseOctets : 4;
      const fineOctets = options.fineOctets !== undefined ? options.fineOctets : 3;
      const agencyEpoch = !!options.agencyEpoch;

      if (coarseOctets < 1 || coarseOctets > 4) {
        throw new Error("CUC coarseOctets must be between 1 and 4.");
      }
      if (fineOctets < 0 || fineOctets > 4) {
        throw new Error("CUC fineOctets must be between 0 and 4.");
      }

      let dateObj = (inputTime instanceof Date) ? inputTime : new Date(inputTime);
      let unixSec = dateObj.getTime() / 1000.0;
      
      // Calculate elapsed seconds since CCSDS Epoch (1958-01-01 TAI)
      // TAI = UTC + 37s
      let taiUnixSec = unixSec + TAI_MINUS_UTC_2026;
      let ccsdsSec = taiUnixSec + CCSDS_TO_UNIX_OFFSET_SEC;
      if (ccsdsSec < 0) ccsdsSec = 0;

      let coarseSec = Math.floor(ccsdsSec);
      let fineFraction = ccsdsSec - coarseSec;

      // Build P-Field
      // Bit 0: extension flag (0 for 1 octet)
      // Bits 1-3: Time code id (010 = CCSDS epoch, 001 = Agency epoch)
      // Bits 4-5: Number of octets of coarse time minus 1
      // Bits 6-7: Number of octets of fine time
      let extBit = 0;
      let timeCodeId = agencyEpoch ? 1 : 2;
      let coarseBits = (coarseOctets - 1) & 0x03;
      let fineBits = (fineOctets <= 3) ? (fineOctets & 0x03) : 3;

      let pByte = (extBit << 7) | (timeCodeId << 4) | (coarseBits << 2) | fineBits;
      let pField = [pByte];

      // If fineOctets is 4, we use the extension octet
      if (fineOctets === 4) {
        pField[0] = pField[0] | 0x80; // set extension bit
        pField.push(4 & 0x7F); // second octet indicates 4 fine octets
      }

      // Build T-Field
      let tField = [];
      // Coarse time: big-endian integer
      for (let i = coarseOctets - 1; i >= 0; i--) {
        let byte = Math.floor((coarseSec / Math.pow(256, i))) & 0xFF;
        tField.push(byte);
      }

      // Fine time: binary fraction
      let rem = fineFraction;
      for (let i = 0; i < fineOctets; i++) {
        rem = rem * 256;
        let byte = Math.floor(rem) & 0xFF;
        tField.push(byte);
        rem = rem - Math.floor(rem);
      }

      let fullBytes = pField.concat(tField);
      let hex = fullBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      return {
        format: "CCSDS-CUC",
        pField: new Uint8Array(pField),
        tField: new Uint8Array(tField),
        hex: hex,
        coarseSeconds: coarseSec,
        fineFraction: fineFraction,
        totalBytes: fullBytes.length,
        epoch: agencyEpoch ? "Agency Defined" : "1958-01-01 00:00:00 TAI",
        taiTimestamp: new Date((ccsdsSec - CCSDS_TO_UNIX_OFFSET_SEC - TAI_MINUS_UTC_2026) * 1000).toISOString()
      };
    }

    /**
     * Decodes CCSDS CUC bytes back to timestamp and values
     */
    decodeCUC(byteArray) {
      if (!byteArray || byteArray.length < 2) {
        throw new Error("Invalid CUC byte sequence: minimum length is 2 octets.");
      }
      let idx = 0;
      let p0 = byteArray[idx++];
      let extBit = (p0 >> 7) & 0x01;
      let timeCodeId = (p0 >> 4) & 0x07;
      let coarseOctets = ((p0 >> 2) & 0x03) + 1;
      let fineOctets = p0 & 0x03;

      if (extBit === 1) {
        if (byteArray.length <= idx) throw new Error("CUC extension bit set but octet 2 missing.");
        let p1 = byteArray[idx++];
        fineOctets = p1 & 0x7F;
      }

      if (byteArray.length < idx + coarseOctets + fineOctets) {
        throw new Error("CUC payload truncated: expected " + (idx + coarseOctets + fineOctets) + " octets.");
      }

      let coarseSec = 0;
      for (let i = 0; i < coarseOctets; i++) {
        coarseSec = (coarseSec * 256) + byteArray[idx++];
      }

      let fineFraction = 0;
      let factor = 1.0;
      for (let i = 0; i < fineOctets; i++) {
        factor /= 256.0;
        fineFraction += byteArray[idx++] * factor;
      }

      let ccsdsSec = coarseSec + fineFraction;
      let taiUnixSec = ccsdsSec - CCSDS_TO_UNIX_OFFSET_SEC;
      let utcUnixSec = taiUnixSec - TAI_MINUS_UTC_2026;
      let date = new Date(utcUnixSec * 1000);

      return {
        format: "CCSDS-CUC",
        timeCodeId: timeCodeId,
        coarseOctets: coarseOctets,
        fineOctets: fineOctets,
        coarseSeconds: coarseSec,
        fineFraction: fineFraction,
        isoUTC: date.toISOString(),
        taiSeconds: ccsdsSec
      };
    }

    /**
     * Encodes a Date to CCSDS CDS (Day Segmented Time Code)
     * @param {Date|string} inputTime
     * @param {Object} options - { dayBits: 16|24, resolution: 'ms'|'us'|'ps' }
     */
    encodeCDS(inputTime, options = {}) {
      const dayBits = options.dayBits === 24 ? 24 : 16;
      const resolution = options.resolution || 'us'; // 'ms' or 'us'
      let dateObj = (inputTime instanceof Date) ? inputTime : new Date(inputTime);
      let unixMs = dateObj.getTime();

      // Epoch: 1958-01-01 00:00:00 TAI
      // Unix epoch in TAI ms:
      let taiUnixMs = unixMs + (TAI_MINUS_UTC_2026 * 1000);
      let ccsdsMs = taiUnixMs + (CCSDS_TO_UNIX_OFFSET_SEC * 1000);

      let dayCount = Math.floor(ccsdsMs / 86400000.0);
      let msOfDay = Math.floor(ccsdsMs % 86400000.0);
      let usFraction = Math.floor((ccsdsMs % 1.0) * 1000.0);

      let maxDays = (dayBits === 16) ? 65535 : 16777215;
      if (dayCount > maxDays) {
        throw new Error(`CDS day count ${dayCount} exceeds ${dayBits}-bit limit (${maxDays}).`);
      }

      // P-Field
      let timeCodeId = (dayBits === 16) ? 4 : 5; // 100 = 16-bit, 101 = 24-bit
      let subSecCode = (resolution === 'ms') ? 0 : 1; // 0 = ms, 1 = us
      let pByte = (0 << 7) | (timeCodeId << 4) | (0 << 3) | (subSecCode & 0x07);

      let tField = [];
      // Day count (16 or 24 bits)
      if (dayBits === 24) {
        tField.push((dayCount >> 16) & 0xFF);
      }
      tField.push((dayCount >> 8) & 0xFF);
      tField.push(dayCount & 0xFF);

      // Milliseconds of day (32 bits)
      tField.push((msOfDay >> 24) & 0xFF);
      tField.push((msOfDay >> 16) & 0xFF);
      tField.push((msOfDay >> 8) & 0xFF);
      tField.push(msOfDay & 0xFF);

      // Microseconds (16 bits) if resolution == 'us'
      if (resolution === 'us') {
        tField.push((usFraction >> 8) & 0xFF);
        tField.push(usFraction & 0xFF);
      }

      let fullBytes = [pByte].concat(tField);
      let hex = fullBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      return {
        format: "CCSDS-CDS",
        pField: new Uint8Array([pByte]),
        tField: new Uint8Array(tField),
        hex: hex,
        dayBits: dayBits,
        dayCount: dayCount,
        msOfDay: msOfDay,
        usFraction: usFraction,
        resolution: resolution,
        totalBytes: fullBytes.length,
        epoch: "1958-01-01 00:00:00 TAI",
        isoUTC: dateObj.toISOString()
      };
    }

    /**
     * Decodes CCSDS CDS bytes
     */
    decodeCDS(byteArray) {
      if (!byteArray || byteArray.length < 7) {
        throw new Error("Invalid CDS byte sequence: minimum length is 7 octets.");
      }
      let idx = 0;
      let pByte = byteArray[idx++];
      let timeCodeId = (pByte >> 4) & 0x07;
      let dayBits = (timeCodeId === 5) ? 24 : 16;
      let subSecCode = pByte & 0x07;

      let dayCount = 0;
      if (dayBits === 24) {
        dayCount = (byteArray[idx++] << 16) | (byteArray[idx++] << 8) | byteArray[idx++];
      } else {
        dayCount = (byteArray[idx++] << 8) | byteArray[idx++];
      }

      let msOfDay = ((byteArray[idx++] << 24) >>> 0) |
                    (byteArray[idx++] << 16) |
                    (byteArray[idx++] << 8) |
                    byteArray[idx++];

      let usFraction = 0;
      if (subSecCode === 1 && byteArray.length >= idx + 2) {
        usFraction = (byteArray[idx++] << 8) | byteArray[idx++];
      }

      let ccsdsMs = (dayCount * 86400000.0) + msOfDay + (usFraction / 1000.0);
      let taiUnixMs = ccsdsMs - (CCSDS_TO_UNIX_OFFSET_SEC * 1000);
      let utcUnixMs = taiUnixMs - (TAI_MINUS_UTC_2026 * 1000);
      let date = new Date(utcUnixMs);

      return {
        format: "CCSDS-CDS",
        dayBits: dayBits,
        dayCount: dayCount,
        msOfDay: msOfDay,
        usFraction: usFraction,
        subSecCode: subSecCode,
        isoUTC: date.toISOString(),
        ccsdsDayCount: dayCount
      };
    }

    /**
     * Formats Date to CCSDS ASCII Formats (Level A and Level B)
     */
    formatASCII(inputTime) {
      let d = (inputTime instanceof Date) ? inputTime : new Date(inputTime);
      let YYYY = d.getUTCFullYear().toString().padStart(4, '0');
      let MM = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      let DD = d.getUTCDate().toString().padStart(2, '0');
      let hh = d.getUTCHours().toString().padStart(2, '0');
      let mm = d.getUTCMinutes().toString().padStart(2, '0');
      let ss = d.getUTCSeconds().toString().padStart(2, '0');
      let ms = d.getUTCMilliseconds().toString().padStart(3, '0');

      // Day of year calculation
      let startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      let dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000) + 1;
      let DDD = dayOfYear.toString().padStart(3, '0');

      return {
        levelA_FormatA: `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}.${ms}Z`,
        levelA_FormatB: `${YYYY}-${DDD}T${hh}:${mm}:${ss}.${ms}Z`,
        levelB_FormatA: `${YYYY}${MM}${DD}T${hh}${mm}${ss}.${ms}Z`,
        levelB_FormatB: `${YYYY}${DDD}T${hh}${mm}${ss}.${ms}Z`
      };
    }

    /**
     * Synchronizes and calculates multi-scale time representations
     */
    synchronizeTimeScales(inputTime) {
      let d = (inputTime instanceof Date) ? inputTime : new Date(inputTime);
      let unixSec = d.getTime() / 1000.0;
      let jd = (unixSec / 86400.0) + 2440587.5;
      let mjd = jd - 2400000.5;

      let taiSec = unixSec + TAI_MINUS_UTC_2026;
      let gpsSec = taiSec - TAI_MINUS_GPS;
      let ttSec = taiSec + TT_MINUS_TAI;
      
      // TDB approximation (fair-precision barycentric dynamical time)
      let t = (jd - 2451545.0) / 36525.0; // centuries since J2000
      let meanAnomaly = 357.5277233 + 35999.05034 * t;
      let gRad = meanAnomaly * (Math.PI / 180.0);
      let tdbDelta = 0.001657 * Math.sin(gRad + 0.01671 * Math.sin(gRad));
      let tdbSec = ttSec + tdbDelta;

      return {
        utcIso: d.toISOString(),
        taiTimestamp: new Date((taiSec) * 1000).toISOString(),
        gpsTimestamp: new Date((gpsSec) * 1000).toISOString(),
        ttTimestamp: new Date((ttSec) * 1000).toISOString(),
        offsets: {
          taiMinusUtc: TAI_MINUS_UTC_2026,
          taiMinusGps: TAI_MINUS_GPS,
          ttMinusTai: TT_MINUS_TAI,
          tdbCorrectionSec: tdbDelta
        },
        julianDate: jd.toFixed(6),
        modifiedJulianDate: mjd.toFixed(6),
        epochCcsdsDays: ((taiSec + CCSDS_TO_UNIX_OFFSET_SEC) / 86400.0).toFixed(6)
      };
    }
  }

  return TimeCodeEngine;
}));
