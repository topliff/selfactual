// ACL Turtle generators for master and sub pods.
// Templates from docs/next-conversation-starter.md lines 272-316.

const CSS_BASE_URL = process.env.CSS_BASE_URL || "https://vaults.selfactual.ai";

/**
 * Generate ACL for the master pod container.
 * Owner gets full control, service account gets Read+Write.
 */
export function generateMasterAcl(username, webId, serviceWebId) {
  const masterUrl = `${CSS_BASE_URL}/${username}/master/`;

  return `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
    a acl:Authorization ;
    acl:agent           <${webId}> ;
    acl:accessTo        <${masterUrl}> ;
    acl:default         <${masterUrl}> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

<#serviceWrite>
    a acl:Authorization ;
    acl:agent           <${serviceWebId}> ;
    acl:accessTo        <${masterUrl}> ;
    acl:default         <${masterUrl}> ;
    acl:mode            acl:Read, acl:Write .
`;
}

/**
 * Generate ACL for the sub pod container.
 * Owner gets full control, service account gets Read+Write,
 * first-party app origin gets Read.
 */
export function generateSubAcl(username, webId, serviceWebId) {
  const subUrl = `${CSS_BASE_URL}/${username}/sub/`;

  return `@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
    a acl:Authorization ;
    acl:agent           <${webId}> ;
    acl:accessTo        <${subUrl}> ;
    acl:default         <${subUrl}> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

<#firstPartyAppRead>
    a acl:Authorization ;
    acl:origin          <https://app.selfactual.ai> ;
    acl:accessTo        <${subUrl}> ;
    acl:default         <${subUrl}> ;
    acl:mode            acl:Read .

<#serviceWrite>
    a acl:Authorization ;
    acl:agent           <${serviceWebId}> ;
    acl:accessTo        <${subUrl}> ;
    acl:default         <${subUrl}> ;
    acl:mode            acl:Read, acl:Write .
`;
}
