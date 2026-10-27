\# CCSDS 301.0-B-4 Time Code Formats Specification

\#\# 1\. Overview  
The \*\*Consultative Committee for Space Data Systems (CCSDS)\*\* Recommendation \*\*CCSDS 301.0-B-4\*\* (and its identical counterpart \*\*ISO 11104\*\*) establishes standard time code formats for exchanging time information between space systems, telemetry receivers, tracking networks, and ground control stations.

TimeCodeForge Pro implements full bidirectional encoding, decoding, validation, and auditing for all normative formats described in the specification:  
1\. \*\*CCSDS Unsegmented Time Code (CUC)\*\*  
2\. \*\*CCSDS Day Segmented Time Code (CDS)\*\*  
3\. \*\*CCSDS Calendar Segmented Time Code (CCS)\*\*  
4\. \*\*CCSDS ASCII Time Code Formats (Levels A and B)\*\*  
5\. \*\*Astronomical & Relativistic Time Scales (TAI, UTC, GPS, TT, TDB)\*\*

\---

\#\# 2\. CCSDS Unsegmented Time Code (CUC)

\#\#\# P-Field (Preamble Field)  
The P-field conveys structural metadata about the time code.  
\- \*\*Single-Octet P-Field\*\*:  
  \- \`Bit 0\`: Extension flag (\`0\` \= no extension octet, \`1\` \= extended P-field).  
  \- \`Bits 1-3\`: Time Code Identification:  
    \- \`001\`: Agency-defined epoch.  
    \- \`010\`: CCSDS Defined Epoch (1958 January 1 00:00:00 TAI).  
  \- \`Bits 4-5\`: Number of octets of coarse time minus 1 (\`00\` \= 1 octet, \`01\` \= 2 octets, \`10\` \= 3 octets, \`11\` \= 4 octets).  
  \- \`Bits 6-7\`: Number of octets of fine time (\`00\` \= 0 octets, \`01\` \= 1 octet, \`10\` \= 2 octets, \`11\` \= 3 octets).  
\- \*\*Extended P-Field (2 Octets)\*\*:  
  \- If Bit 0 is \`1\`, the second octet provides additional fine time octet count (allowing sub-nanosecond precision up to 4 or more fine octets).

\#\#\# T-Field (Time Field)  
\- \*\*Coarse Time\*\*: 1 to 4 octets representing integer seconds elapsed since the specified epoch.  
\- \*\*Fine Time\*\*: 0 to 4 octets representing binary fractions of a second (\$2^{-8}\$, \$2^{-16}\$, \$2^{-24}\$, \$2^{-32}\$).  
  \- 1 octet: \$\\Delta t \= 2^{-8} \\approx 3.90625\\text{ ms}\$  
  \- 2 octets: \$\\Delta t \= 2^{-16} \\approx 15.25879\\text{ }\\mu\\text{s}\$  
  \- 3 octets: \$\\Delta t \= 2^{-24} \\approx 59.60464\\text{ ns}\$  
  \- 4 octets: \$\\Delta t \= 2^{-32} \\approx 0.23283\\text{ ns}\$

\---

\#\# 3\. CCSDS Day Segmented Time Code (CDS)

The CDS format segments time into elapsed days and fractions of a day.

\#\#\# P-Field  
\- \`Bits 1-3\`:  
  \- \`100\`: CDS with 16-bit day count (up to 65,535 days \$\\approx\$ year 2137).  
  \- \`101\`: CDS with 24-bit day count (up to 16,777,215 days \$\\approx\$ year 47900).  
\- \`Bit 4\`: Epoch identification (\`0\` \= 1958 Jan 1 TAI).  
\- \`Bits 5-7\`: Subsecond resolution:  
  \- \`000\`: Millisecond precision (32-bit millisecond of day).  
  \- \`001\`: Microsecond precision (32-bit millisecond \+ 16-bit microsecond).  
  \- \`010\`: Picosecond precision (32-bit ms \+ 16-bit \$\\mu\$s \+ 16-bit ps).

\---

\#\# 4\. Multi-Scale Time Offsets  
In mission telemetry, time codes must synchronize across atomic and relativistic references:  
\- \$\\text{TAI} \= \\text{UTC} \+ 37\\text{ s}\$ (in 2026\)  
\- \$\\text{GPS} \= \\text{TAI} \- 19\\text{ s} \= \\text{UTC} \+ 18\\text{ s}\$  
\- \$\\text{TT} \= \\text{TAI} \+ 32.184\\text{ s}\$  
\- \$\\text{TDB} \\approx \\text{TT} \+ 0.001657\\sin(g)\$ (Barycentric Dynamical Time)  
