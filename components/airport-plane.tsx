export default function AirportPlane({direction}:{direction:"to"|"from"}) {
  return <span className={`airportPlane airportPlane--${direction}`} aria-hidden="true"><img src="/landvetter-plane-realistic.webp" alt="" width="100" height="50" /></span>;
}
