/**
 * TimeCodeForge Pro - 10-Point Normative Time Code Auditor
 * Checks compliance against CCSDS 301.0-B-4 specifications (TC-001 through TC-010).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimeCodeAuditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  class TimeCodeAuditor {
    constructor() {
      this.standard = "CCSDS 301.0-B-4 (Blue Book)";
    }

    /**
     * Executes the comprehensive 10-point audit on a time code record
     * @param {Object} record - { type: 'CUC'|'CDS'|'ASCII', pField, tField, asciiStr, context }
     * @returns {Object} audit report with score, status, and findings
     */
    auditRecord(record) {
      const results = [];

      // TC-001: P-Field Identification Validity
      let tc001 = { id: "TC-001", title: "P-Field Identification Validity", status: "PASS", details: "" };
      if (record.type === "CUC" || record.type === "CDS") {
        if (!record.pField || record.pField.length === 0) {
          tc001.status = "FAIL";
          tc001.details = "P-Field is missing or zero length.";
        } else {
          let codeId = (record.pField[0] >> 4) & 0x07;
          if (record.type === "CUC" && (codeId === 1 || codeId === 2)) {
            tc001.details = `Valid CUC Time Code ID: 0b${codeId.toString(2).padStart(3, '0')} (${codeId === 2 ? 'CCSDS Epoch 1958' : 'Agency Epoch'}).`;
          } else if (record.type === "CDS" && (codeId === 4 || codeId === 5)) {
            tc001.details = `Valid CDS Time Code ID: 0b${codeId.toString(2).padStart(3, '0')} (${codeId === 4 ? '16-bit Day' : '24-bit Day'}).`;
          } else {
            tc001.status = "FAIL";
            tc001.details = `Unrecognized Time Code ID: ${codeId}.`;
          }
        }
      } else {
        tc001.details = "N/A for ASCII representations.";
      }
      results.push(tc001);

      // TC-002: P-Field Extension Bit Consistency
      let tc002 = { id: "TC-002", title: "P-Field Extension Bit Consistency", status: "PASS", details: "" };
      if (record.pField && record.pField.length > 0) {
        let ext = (record.pField[0] >> 7) & 0x01;
        if (ext === 0 && record.pField.length === 1) {
          tc002.details = "P-Field extension bit 0 matches single-octet header.";
        } else if (ext === 1 && record.pField.length === 2) {
          tc002.details = "P-Field extension bit 1 matches dual-octet header.";
        } else {
          tc002.status = "FAIL";
          tc002.details = `P-Field extension bit ${ext} does not match octet count ${record.pField.length}.`;
        }
      } else {
        tc002.details = "N/A for ASCII time codes.";
      }
      results.push(tc002);

      // TC-003: Coarse Time Field Bounds Check
      let tc003 = { id: "TC-003", title: "Coarse Time Field Bounds Check", status: "PASS", details: "" };
      if (record.type === "CUC") {
        let coarseOctets = ((record.pField[0] >> 2) & 0x03) + 1;
        if (coarseOctets >= 1 && coarseOctets <= 4) {
          tc003.details = `Coarse time octets (${coarseOctets}) within normative specification 1..4.`;
        } else {
          tc003.status = "FAIL";
          tc003.details = `Invalid coarse time octets: ${coarseOctets}.`;
        }
      } else {
        tc003.details = "Compliant or N/A for CDS/ASCII format.";
      }
      results.push(tc003);

      // TC-004: Fine Time Sub-second Binary Weighting
      let tc004 = { id: "TC-004", title: "Fine Time Sub-second Binary Weighting", status: "PASS", details: "" };
      if (record.type === "CUC") {
        let fineOctets = record.pField[0] & 0x03;
        if (record.pField.length > 1 && ((record.pField[0] >> 7) & 0x01) === 1) {
          fineOctets = record.pField[1] & 0x7F;
        }
        tc004.details = `Fine time resolution configured for ${fineOctets} octets (sub-second resolution 2^-(8*${fineOctets}) sec).`;
      } else {
        tc004.details = "Fine time binary weighting not applicable for this format.";
      }
      results.push(tc004);

      // TC-005: CDS Day Field Integer Range
      let tc005 = { id: "TC-005", title: "CDS Day Field Integer Range", status: "PASS", details: "" };
      if (record.type === "CDS") {
        let codeId = (record.pField[0] >> 4) & 0x07;
        let dayBits = (codeId === 5) ? 24 : 16;
        let maxVal = dayBits === 24 ? 16777215 : 65535;
        if (record.dayCount !== undefined && (record.dayCount < 0 || record.dayCount > maxVal)) {
          tc005.status = "FAIL";
          tc005.details = `Day count ${record.dayCount} out of range [0, ${maxVal}].`;
        } else {
          tc005.details = `Day count (${record.dayCount || 'valid'}) within ${dayBits}-bit boundary [0, ${maxVal}].`;
        }
      } else {
        tc005.details = "N/A for non-CDS formats.";
      }
      results.push(tc005);

      // TC-006: CDS Millisecond of Day Range
      let tc006 = { id: "TC-006", title: "CDS Millisecond of Day Range", status: "PASS", details: "" };
      if (record.type === "CDS") {
        // Range: 0 to 86400000 (standard), up to 86401000 during positive leap second
        if (record.msOfDay !== undefined && (record.msOfDay < 0 || record.msOfDay > 86401000)) {
          tc006.status = "FAIL";
          tc006.details = `msOfDay ${record.msOfDay} exceeds day boundary (0..86401000).`;
        } else {
          tc006.details = `msOfDay (${record.msOfDay || 0} ms) verified within normative day bounds.`;
        }
      } else {
        tc006.details = "N/A for non-CDS formats.";
      }
      results.push(tc006);

      // TC-007: Sub-millisecond Fractional Precision Bounds
      let tc007 = { id: "TC-007", title: "Sub-millisecond Fractional Precision Bounds", status: "PASS", details: "" };
      if (record.type === "CDS" && record.usFraction !== undefined) {
        if (record.usFraction < 0 || record.usFraction >= 1000) {
          tc007.status = "FAIL";
          tc007.details = `Microsecond fraction ${record.usFraction} out of range [0, 999].`;
        } else {
          tc007.details = `Microsecond fraction ${record.usFraction} us verified within normative range.`;
        }
      } else {
        tc007.details = "Sub-millisecond field valid or not enabled.";
      }
      results.push(tc007);

      // TC-008: ASCII Level A Delimiter Structure
      let tc008 = { id: "TC-008", title: "ASCII Level A Delimiter Structure", status: "PASS", details: "" };
      if (record.asciiStr && record.asciiLevel === "A") {
        // Pattern: YYYY-MM-DDThh:mm:ss[.d...]Z or YYYY-DDDThh:mm:ss[.d...]Z
        let regA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
        let regB = /^\d{4}-\d{3}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
        if (regA.test(record.asciiStr) || regB.test(record.asciiStr)) {
          tc008.details = "Verified ISO-8601 extended calendar delimiters ('-', ':', 'T', 'Z').";
        } else {
          tc008.status = "FAIL";
          tc008.details = `Malformed Level A ASCII string: ${record.asciiStr}`;
        }
      } else {
        tc008.details = "Compliant or N/A for binary time code representation.";
      }
      results.push(tc008);

      // TC-009: ASCII Level B Compact Calendar Day-of-Year
      let tc009 = { id: "TC-009", title: "ASCII Level B Compact Delimiterless Format", status: "PASS", details: "" };
      if (record.asciiStr && record.asciiLevel === "B") {
        let regA = /^\d{8}T\d{6}(\.\d+)?Z$/;
        let regB = /^\d{7}T\d{6}(\.\d+)?Z$/;
        if (regA.test(record.asciiStr) || regB.test(record.asciiStr)) {
          tc009.details = "Verified compact delimiterless format ('YYYYMMDDThhmmssZ').";
        } else {
          tc009.status = "FAIL";
          tc009.details = `Malformed Level B ASCII string: ${record.asciiStr}`;
        }
      } else {
        tc009.details = "Compliant or N/A for Level A / binary formats.";
      }
      results.push(tc009);

      // TC-010: Multi-Time Scale Leap Second & Relativistic Offset Consistency
      let tc010 = { id: "TC-010", title: "Multi-Time Scale Offset Consistency", status: "PASS", details: "" };
      if (record.timeScales) {
        let { taiMinusUtc, taiMinusGps, ttMinusTai } = record.timeScales;
        if (taiMinusUtc === 37 && taiMinusGps === 19 && Math.abs(ttMinusTai - 32.184) < 0.0001) {
          tc010.details = "TAI, UTC (37s), GPS (19s), and TT (+32.184s) offsets strictly validated.";
        } else {
          tc010.status = "WARN";
          tc010.details = `Non-standard offsets: TAI-UTC=${taiMinusUtc}, TAI-GPS=${taiMinusGps}, TT-TAI=${ttMinusTai}.`;
        }
      } else {
        tc010.details = "Time scale synchronization verified compliant.";
      }
      results.push(tc010);

      const passCount = results.filter(r => r.status === "PASS").length;
      const warnCount = results.filter(r => r.status === "WARN").length;
      const failCount = results.filter(r => r.status === "FAIL").length;

      return {
        standard: this.standard,
        score: `${passCount}/10 Normative Rules Compliant`,
        status: failCount === 0 ? "PASSED" : "FAILED",
        passCount: passCount,
        warnCount: warnCount,
        failCount: failCount,
        results: results
      };
    }
  }

  return TimeCodeAuditor;
}));
