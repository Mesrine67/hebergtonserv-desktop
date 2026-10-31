use crate::errors::{Result, app_error, unavailable_error};
use std::net::IpAddr;
use std::str::FromStr;
use url::Url;

/// Maximum accepted JSON request body size (defense against large-payload abuse).
pub const MAX_REQUEST_BODY_BYTES: usize = 2 * 1024 * 1024;

fn is_blocked_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(value) => {
            value.is_loopback()
                || value.is_unspecified()
                || value.is_multicast()
                || value.is_link_local()
                || value.is_private()
                // Carrier-grade NAT, benchmarking, reserved and zero-net addresses
                // are not safe public destinations for user-configured panels.
                || matches!(value.octets(), [100, b, ..] if (b & 0b1100_0000) == 0b0100_0000)
                || matches!(value.octets(), [198, 18 | 19, ..])
                || matches!(value.octets(), [0, ..])
                || matches!(value.octets(), [a, ..] if a >= 240)
        }
        IpAddr::V6(value) => {
            value.is_loopback()
                || value.is_unspecified()
                || value.is_multicast()
                || value.is_unique_local()
                || value.is_unicast_link_local()
                || value
                    .to_ipv4_mapped()
                    .is_some_and(|mapped| is_blocked_ip(&IpAddr::V4(mapped)))
        }
    }
}

fn host_is_blocked(host: &str, allow_local: bool) -> bool {
    // url::Url::host_str() may include brackets around IPv6 literals.
    let value = host
        .strip_prefix('[')
        .and_then(|s| s.strip_suffix(']'))
        .unwrap_or(host);
    if value.is_empty() {
        return true;
    }
    if value.eq_ignore_ascii_case("localhost") {
        return !allow_local;
    }
    let Ok(ip) = IpAddr::from_str(value) else {
        return false;
    };
    is_blocked_ip(&ip) && !(allow_local && ip.is_loopback())
}

/// Validates a panel base URL: HTTPS only, no credentials, no query/fragment,
/// no loopback/private targets unless explicitly allowed, bounded length.
pub fn validate_panel_url(raw: &str, allow_local: bool) -> Result<Url> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 {
        return Err(app_error(
            "invalid_url",
            "Le panneau doit fournir une URL valide.",
        ));
    }

    let url = Url::parse(trimmed).map_err(|_| {
        app_error(
            "invalid_url",
            "Le panneau doit fournir une URL valide (https requis).",
        )
    })?;

    if url.scheme() != "https" {
        return Err(app_error(
            "invalid_url",
            "Seuls les panneaux HTTPS sont acceptés.",
        ));
    }
    if !url.has_host() || url.host_str().is_none() {
        return Err(app_error("invalid_url", "Une adresse hôte est requise."));
    }
    if url.username() != "" || url.password().is_some() {
        return Err(app_error(
            "invalid_url",
            "Les identifiants ne sont pas acceptés.",
        ));
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err(app_error(
            "invalid_url",
            "Les requêtes ou fragments sont interdits.",
        ));
    }

    let host = url
        .host_str()
        .ok_or_else(|| unavailable_error("Le panneau doit fournir une adresse hôte valide."))?;
    if host_is_blocked(host, allow_local) {
        return Err(app_error(
            "invalid_url",
            "Le hôte du panneau n'est pas autorisé.",
        ));
    }

    Ok(url)
}

/// Resolves a hostname and rejects any loopback/private/link-local IP result.
/// Called before the HTTP client connects, after DNS resolution.
pub async fn resolve_allowed_addrs(
    url: &Url,
    allow_local: bool,
) -> Result<Vec<std::net::SocketAddr>> {
    if url.host_str().is_none() {
        return Err(app_error(
            "invalid_url",
            "Le panneau doit fournir une adresse hôte valide.",
        ));
    }
    let host = url.host_str().unwrap();
    let port = url.port().unwrap_or(443);
    let target = format!("{}:{}", host, port);
    let resolved = tokio::net::lookup_host(&target)
        .await
        .map_err(|_| unavailable_error("Le panneau est injoignable."))?;
    let mut allowed = Vec::new();
    for address in resolved {
        let ip = address.ip();
        if is_blocked_ip(&ip) && !(allow_local && ip.is_loopback()) {
            return Err(app_error(
                "invalid_url",
                "Le panneau renvoie une adresse IP non autorisée.",
            ));
        }
        allowed.push(address);
    }
    if allowed.is_empty() {
        return Err(unavailable_error(
            "Aucune adresse IP du panneau n'a été trouvée.",
        ));
    }
    Ok(allowed)
}

pub async fn verify_resolved_host(url: &Url, allow_local: bool) -> Result<()> {
    resolve_allowed_addrs(url, allow_local).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_https() {
        assert!(validate_panel_url("http://example.com/", false).is_err());
    }

    #[test]
    fn accepts_valid_https() {
        let url = validate_panel_url("https://manage.hebergtonserv.com/", false).unwrap();
        assert_eq!(url.host_str(), Some("manage.hebergtonserv.com"));
    }

    #[test]
    fn rejects_credentials() {
        assert!(validate_panel_url("https://user:pass@example.com/", false).is_err());
    }

    #[test]
    fn rejects_private_ipv6_and_mapped_ipv4() {
        assert!(validate_panel_url("https://[fc00::1]/", false).is_err());
        assert!(validate_panel_url("https://[fe80::1]/", false).is_err());
        assert!(validate_panel_url("https://[::ffff:127.0.0.1]/", false).is_err());
    }

    #[test]
    fn explicit_local_override_only_allows_loopback() {
        assert!(validate_panel_url("https://localhost/", true).is_ok());
        assert!(validate_panel_url("https://127.0.0.1/", true).is_ok());
        assert!(validate_panel_url("https://192.168.1.4/", true).is_err());
    }

    #[test]
    fn rejects_cgnat_benchmarking_and_reserved_ipv4() {
        for ip in ["100.64.0.1", "100.127.255.254", "198.18.0.5", "198.19.1.1", "0.2.3.4", "240.0.0.1"] {
            assert!(validate_panel_url(&format!("https://{ip}/"), false).is_err(), "accepted {ip}");
            assert!(validate_panel_url(&format!("https://{ip}/"), true).is_err(), "local override accepted {ip}");
        }
        assert!(validate_panel_url("https://8.8.8.8/", false).is_ok());
        assert!(validate_panel_url("https://[::ffff:100.64.0.1]/", false).is_err());
    }

    #[test]
    fn rejects_loopback() {
        assert!(validate_panel_url("https://127.0.0.1/", false).is_err());
        assert!(validate_panel_url("https://localhost/", false).is_err());
    }
}
