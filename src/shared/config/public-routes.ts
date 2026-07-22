function getContactPath() {
  return "/kontakt";
}

function getElectricityPath() {
  return "/struja";
}

function getEventsPath() {
  return "/dogadjaji";
}

function getEventDetailPath(eventId: string) {
  return `${getEventsPath()}/${encodeURIComponent(eventId)}`;
}

function getFlightsPath() {
  return "/letovi";
}

function getGoingOutPath() {
  return "/izlasci";
}

function getPrivacyPolicyPath() {
  return "/politika-privatnosti";
}

function getTermsOfUsePath() {
  return "/uslovi-koriscenja";
}

export {
  getContactPath,
  getElectricityPath,
  getEventDetailPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
};
