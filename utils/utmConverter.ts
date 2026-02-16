// Basic implementation of WGS84 <=> UTM conversion
// Focusing on Thailand zones (47N, 48N)
// Based on standard UTM conversion formulas

const RADIANS_PER_DEGREE = Math.PI / 180.0;
const DEGREES_PER_RADIAN = 180.0 / Math.PI;

const K0 = 0.9996;
const E = 0.00669438;
const R = 6378137; // Radius of Earth (WGS84)

export function toUTM(lat: number, lon: number) {
    const zone = Math.floor((lon + 180.0) / 6) + 1;
    const latRad = lat * RADIANS_PER_DEGREE;
    const lonRad = lon * RADIANS_PER_DEGREE;
    const lonOrigin = (zone - 1) * 6 - 180 + 3;
    const lonOriginRad = lonOrigin * RADIANS_PER_DEGREE;
    const ect = Math.sqrt(E / (1 - E));

    const N = R / Math.sqrt(1 - E * Math.sin(latRad) * Math.sin(latRad));
    const T = Math.tan(latRad) * Math.tan(latRad);
    const C = (E / (1 - E)) * Math.cos(latRad) * Math.cos(latRad); // e'2
    const A = Math.cos(latRad) * (lonRad - lonOriginRad);

    const M = R * (
        (1 - E / 4 - 3 * E * E / 64 - 5 * E * E * E / 256) * latRad
        - (3 * E / 8 + 3 * E * E / 32 + 45 * E * E * E / 1024) * Math.sin(2 * latRad)
        + (15 * E * E / 256 + 45 * E * E * E / 1024) * Math.sin(4 * latRad)
        - (35 * E * E * E / 3072) * Math.sin(6 * latRad)
    );

    const easting = K0 * N * (
        A + (1 - T + C) * A * A * A / 6
        + (5 - 18 * T + T * T + 72 * C - 58 * E / (1 - E)) * A * A * A * A * A / 120
    ) + 500000.0;

    const northing = K0 * (M + N * Math.tan(latRad) * (
        A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
        + (61 - 58 * T + T * T + 600 * C - 330 * E / (1 - E)) * A * A * A * A * A * A / 720
    ));

    return {
        zone: zone,
        easting: Math.round(easting),
        northing: Math.round(northing)
    };
}

export function fromUTM(easting: number, northing: number, zone: number) {
    const x = easting - 500000.0;
    const y = northing;

    const lonOrigin = (zone - 1) * 6 - 180 + 3;

    // M derived from northing
    const M = y / K0;

    // Formula for M to roughly Lat
    const mu = M / (R * (1 - E / 4 - 3 * E * E / 64 - 5 * E * E * E / 256));
    const e1 = (1 - Math.sqrt(1 - E)) / (1 + Math.sqrt(1 - E));

    const phi1Rad = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
        + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);

    const N1 = R / Math.sqrt(1 - E * Math.sin(phi1Rad) * Math.sin(phi1Rad));
    const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
    const C1 = (E / (1 - E)) * Math.cos(phi1Rad) * Math.cos(phi1Rad);
    const R1 = R * (1 - E) / Math.pow(1 - E * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
    const D = x / (N1 * K0);

    let lat = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (
        D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * E / (1 - E)) * D * D * D * D / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * E / (1 - E) - 3 * C1 * C1) * D * D * D * D * D * D / 720
    );

    let lon = (D - (1 + 2 * T1 + C1) * D * D * D / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * E / (1 - E) + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1Rad);

    return {
        lat: lat * DEGREES_PER_RADIAN,
        lon: lonOrigin + lon * DEGREES_PER_RADIAN
    };
}
