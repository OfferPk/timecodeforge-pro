#!/usr/bin/env python3
"""
Automated Test Runner for TimeCodeForge Pro
Verifies CUC encoding/decoding, CDS packing, ASCII formatting, and 10-point normative auditor.
"""

import unittest
from datetime import datetime, timezone
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timecode_cli import encode_cuc, decode_cuc, encode_cds, format_ascii, audit_timecode

class TestTimeCodeForge(unittest.TestCase):

    def setUp(self):
        self.ref_dt = datetime(2026, 10, 16, 18, 17, 34, 0, tzinfo=timezone.utc)

    def test_01_cuc_encoding_structure(self):
        res = encode_cuc(self.ref_dt, coarse_octets=4, fine_octets=3)
        self.assertEqual(res["format"], "CCSDS-CUC")
        self.assertEqual(res["total_octets"], 8) # 1 P-field + 4 coarse + 3 fine
        self.assertEqual(res["p_field_hex"], "2F")
        self.assertGreater(res["coarse_seconds"], 2000000000)

    def test_02_cuc_roundtrip_integrity(self):
        cuc = encode_cuc(self.ref_dt, coarse_octets=4, fine_octets=3)
        decoded = decode_cuc(cuc["hex"])
        self.assertEqual(decoded["coarse_seconds"], cuc["coarse_seconds"])
        self.assertAlmostEqual(decoded["fine_fraction"], cuc["fine_fraction"], places=4)

    def test_03_cuc_extension_field(self):
        res = encode_cuc(self.ref_dt, coarse_octets=4, fine_octets=4)
        self.assertEqual(res["total_octets"], 10) # 2 P-field + 4 coarse + 4 fine
        self.assertTrue(res["p_field_hex"].startswith("AF"))

    def test_04_cds_16bit_encoding(self):
        cds = encode_cds(self.ref_dt, day_bits=16, resolution="us")
        self.assertEqual(cds["format"], "CCSDS-CDS")
        self.assertEqual(cds["total_octets"], 9) # 1 P-field + 2 day + 4 ms + 2 us
        self.assertEqual(cds["p_field_hex"], "41")
        self.assertGreater(cds["day_count"], 25000) # days since 1958

    def test_05_cds_24bit_encoding(self):
        cds = encode_cds(self.ref_dt, day_bits=24, resolution="ms")
        self.assertEqual(cds["format"], "CCSDS-CDS")
        self.assertEqual(cds["total_octets"], 8) # 1 P-field + 3 day + 4 ms
        self.assertEqual(cds["p_field_hex"], "50")

    def test_06_ascii_level_a_formatting(self):
        ascii_res = format_ascii(self.ref_dt)
        self.assertTrue("2026-10-16T18:17:34" in ascii_res["level_a_calendar"])
        self.assertTrue("2026-289T18:17:34" in ascii_res["level_a_doy"])

    def test_07_ascii_level_b_formatting(self):
        ascii_res = format_ascii(self.ref_dt)
        self.assertTrue("20261016T181734" in ascii_res["level_b_calendar"])
        self.assertTrue("2026289T181734" in ascii_res["level_b_doy"])

    def test_08_normative_auditor_compliance(self):
        report = audit_timecode({})
        self.assertEqual(report["status"], "PASSED")
        self.assertEqual(len(report["rules"]), 10)
        for r in report["rules"]:
            self.assertEqual(r["status"], "PASS")

    def test_09_time_scale_leap_second_handling(self):
        # TAI = UTC + 37s in 2026
        cuc = encode_cuc(self.ref_dt, coarse_octets=4, fine_octets=0)
        # Verify 37 seconds delta added
        unix_sec = self.ref_dt.timestamp()
        expected_ccsds = int(unix_sec + 37 + 378691200)
        self.assertEqual(cuc["coarse_seconds"], expected_ccsds)

    def test_10_extreme_epoch_boundary(self):
        # Epoch exact boundary test (1958-01-01)
        epoch_dt = datetime(1958, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        cuc = encode_cuc(epoch_dt, coarse_octets=4, fine_octets=0)
        self.assertGreaterEqual(cuc["coarse_seconds"], 0)

if __name__ == "__main__":
    unittest.main()
