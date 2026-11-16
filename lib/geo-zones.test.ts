import {matchTrustedArea} from "./geo-zones.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {fixedZoneResultAllowed, identifyZone, type PriceZone} from "./geo-zones.ts";

const zones: PriceZone[] = [
  {code: "centralen", name: "Centralen", aliases: ["göteborg central", "göteborg centralstation", "göteborg c", "centralstationen", "centralen"]},
  {code: "frolunda", name: "Frölunda", aliases: ["frölunda", "frölunda torg", "västra frölunda"]},
  {code: "majorna", name: "Majorna", aliases: ["majorna"]},
  {code: "tynnered", name: "Tynnered", aliases: ["tynnered"]},
  {code: "linn", name: "Linné", aliases: ["linné"]},
];

test("Göteborg alone is never interpreted as Göteborg C", () => {
  assert.equal(identifyZone(zones, 57.6564471, 11.9158376, ["Göteborg"]), null);
});

test("Mandolingatan is identified as Frölunda, not Centralen", () => {
  const zone = identifyZone(zones, 57.6564471, 11.9158376, [
    "Västra Frölunda",
    "Sydväst",
    "Mandolingatan",
    "Göteborg",
    "26, Mandolingatan, Västra Frölunda, Göteborg",
  ]);
  assert.equal(zone?.code, "frolunda");
});

test("Grevegården resolves through its coordinate-derived parent district", () => {
  const zone = identifyZone(zones, 57.6474044, 11.8939646, [
    "Grevegården",
    "Tynnered",
    "Sydväst",
  ]);
  assert.equal(zone?.code, "tynnered");
});

test("known structured subareas resolve to their existing parent price zones", () => {
  const zone = identifyZone(zones, 57.6966, 11.9516, ["Kommendantsängen", "Centrum"]);
  assert.equal(zone?.code, "linn");
  assert.equal(identifyZone(zones, 57.693, 11.949, ["Olivedal"])?.code, "linn");
  assert.equal(identifyZone(zones, 57.6474, 11.894, ["Grevegården"])?.code, "tynnered");
});

test("A municipality alone cannot assign the town fare", () => {
  const kungsbacka: PriceZone = {code: "kungsbacka", name: "Kungsbacka", aliases: ["kungsbacka"]};
  assert.equal(identifyZone([kungsbacka], 57.487, 12.076, ["Kungsbacka kommun", "Hallands län"]), null);
});

test("important localities without price-zone rows do not receive invented zones", () => {
  const kungsbacka: PriceZone = {code: "kungsbacka", name: "Kungsbacka", aliases: ["kungsbacka"]};
  for (const locality of ["Tjörn", "Smögen", "Stenungsund", "Varberg"]) {
    assert.equal(identifyZone([kungsbacka], 58, 11.6, [locality]), null);
  }
});

test("free address text and partial names cannot select a zone", () => {
  assert.equal(identifyZone(zones, 57.65, 11.9, ["30, Grevegårdsvägen, Göteborg"]), null);
  assert.equal(identifyZone(zones, 57.65, 11.9, ["Majorna-Linné"]), null);
});

test("Centralen requires coordinates close to Göteborg Centralstation", () => {
  assert.equal(identifyZone(zones, 57.6564471, 11.9158376, ["Göteborg Centralstation"]), null);
  assert.equal(identifyZone(zones, 57.7089, 11.9733, ["Göteborg Centralstation"])?.code, "centralen");
});

test("a Centralen result from the price RPC is rejected for ordinary Göteborg addresses", () => {
  assert.equal(fixedZoneResultAllowed("centralen", "Centralen", false, 57.6474044, 11.8939646), false);
  assert.equal(fixedZoneResultAllowed("centralen", "Centralen", true, 57.7089, 11.9733), true);
});

test("the most specific structured-area match wins", () => {
  assert.equal(identifyZone(zones, 57.693, 11.93, ["Majorna", "Göteborg"])?.code, "majorna");
});

test("an exact structured district overrides an overlapping coarse polygon", () => {
  const overlapping: PriceZone[] = [
    {code: "backa", name: "Backa", aliases: ["backa"], boundary: {type: "Polygon", coordinates: [[[11.9,57.7],[12,57.7],[12,57.8],[11.9,57.8],[11.9,57.7]]]}},
    {code: "backatorp", name: "Backatorp", aliases: ["backatorp"]},
  ];
  assert.equal(identifyZone(overlapping, 57.75, 11.98, ["Backatorp"])?.code, "backatorp");
});

test("Legendgatan 164 is geographically identified as Backa",()=>{
  const backa:PriceZone={code:"backa",name:"Backa",aliases:["backa","bällskär"],boundary:{type:"Polygon",coordinates:[[[11.955,57.720],[12.015,57.720],[12.015,57.775],[11.955,57.775],[11.955,57.720]]]}};
  assert.equal(identifyZone([backa],57.7415478,11.9827261,["Bällskär","Backa"])?.code,"backa");
});

test("Smyckegatan polygon gap uses the server-derived Tynnered district", () => {
  const catalog: PriceZone[] = [{code:"tynnered",name:"Tynnered",aliases:["tynnered"],boundary:{type:"Polygon",coordinates:[[[11.89,57.63],[11.91,57.63],[11.91,57.65],[11.89,57.65],[11.89,57.63]]]}}];
  assert.equal(identifyZone(catalog,57.6510077,11.8978237,["Tynnered"]),null);
  assert.equal(matchTrustedArea(catalog,57.6510077,11.8978237,["Tynnered","Sydväst","Göteborgs Stad"])?.code,"tynnered");
  assert.equal(matchTrustedArea(catalog,57.6510077,11.8978237,["Smyckegatan 1, Tynnered"]),null);
  assert.equal(matchTrustedArea(catalog,57.6510077,11.8978237,[]),null);
});
test("trusted area fallback cannot invent a Centralen fare", () => {
  assert.equal(matchTrustedArea([{code:"centralen",name:"Centralen",aliases:["centralen"]}],57.7089,11.9733,["Centralen"]),null);
});
