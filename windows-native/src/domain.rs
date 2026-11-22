use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BookingStatus {
    New,
    Confirmed,
    DueIn,
    CheckedIn,
    DueOut,
    CheckedOut,
    BookingOffer,
    OutOfOrder,
    Cancelled,
}

impl BookingStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Confirmed => "confirmed",
            Self::DueIn => "due_in",
            Self::CheckedIn => "checked_in",
            Self::DueOut => "due_out",
            Self::CheckedOut => "checked_out",
            Self::BookingOffer => "booking_offer",
            Self::OutOfOrder => "out_of_order",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Booking {
    pub id: String,
    #[serde(rename = "resourceId", alias = "resource_id")]
    pub resource_id: String,
    #[serde(rename = "resourceName", alias = "resource_name")]
    pub resource_name: String,
    pub sector: String,
    #[serde(rename = "guestName", alias = "guest_name")]
    pub guest_name: String,
    #[serde(rename = "guestEmail", alias = "guest_email")]
    pub guest_email: String,
    #[serde(rename = "guestPhone", alias = "guest_phone")]
    pub guest_phone: String,
    #[serde(rename = "startDate", alias = "start_date")]
    pub start_date: String,
    #[serde(rename = "endDate", alias = "end_date")]
    pub end_date: String,
    pub status: BookingStatus,
    #[serde(rename = "totalPriceMinor", alias = "total_price_minor")]
    #[serde(default)]
    pub total_price_minor: Option<i64>,
    #[serde(rename = "currencyCode", alias = "currency_code")]
    #[serde(default)]
    pub currency_code: Option<String>,
    #[serde(rename = "paymentStatus", alias = "payment_status")]
    pub payment_status: String,
    pub notes: Option<String>,
    /// Fields present in the TypeScript TimelineBooking contract but not yet
    /// promoted to first-class Rust fields. Flattening preserves them verbatim.
    #[serde(flatten, default)]
    pub extra_fields: BTreeMap<String, Value>,
}

impl Booking {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty() {
            return Err("booking.id is required".into());
        }
        if self.resource_id.trim().is_empty() {
            return Err("booking.resource_id is required".into());
        }
        if self.guest_name.trim().is_empty() {
            return Err("booking.guest_name is required".into());
        }
        if !valid_date(&self.start_date) || !valid_date(&self.end_date) {
            return Err("booking dates must use YYYY-MM-DD".into());
        }
        // The canonical TypeScript validator and PostgreSQL contract permit
        // same-day bookings. A strict end-before-start check is the shared
        // date-only invariant; time-of-day validation belongs to the mapper/UI.
        if self.end_date < self.start_date {
            return Err("booking.end_date must not be before booking.start_date".into());
        }
        match (self.total_price_minor, self.currency_code.as_deref()) {
            (Some(amount), Some(code)) => {
                if amount < 0 {
                    return Err("booking.total_price_minor must be non-negative".into());
                }
                if code.len() != 3 || !code.bytes().all(|byte| byte.is_ascii_uppercase()) {
                    return Err("booking.currency_code must be a three-letter uppercase ISO code".into());
                }
            }
            (None, None) => {
                // TypeScript totalPrice/paymentCurrency remain in extra_fields
                // until a currency-exponent-aware mapper exists.
            }
            _ => return Err("booking minor-unit amount and currency code must be provided together".into()),
        }
        if !matches!(self.sector.as_str(), "hotel" | "resort") {
            return Err("booking.sector must be hotel or resort".into());
        }
        if !matches!(self.payment_status.as_str(), "paid" | "pending" | "partial") {
            return Err("booking.payment_status must be paid, pending or partial".into());
        }
        Ok(())
    }
}

fn valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    if !bytes
        .iter()
        .enumerate()
        .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
    {
        return false;
    }
    let year: u32 = value[0..4].parse().unwrap_or(0);
    let month: u32 = value[5..7].parse().unwrap_or(0);
    let day: u32 = value[8..10].parse().unwrap_or(0);
    let leap = year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    day >= 1 && day <= days_in_month
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Booking {
        Booking {
            id: "b-1".into(),
            resource_id: "r-1".into(),
            resource_name: "101".into(),
            sector: "hotel".into(),
            guest_name: "Guest".into(),
            guest_email: "".into(),
            guest_phone: "".into(),
            start_date: "2026-11-21".into(),
            end_date: "2026-11-23".into(),
            status: BookingStatus::Confirmed,
            total_price_minor: Some(1_200_000),
            currency_code: Some("DZD".into()),
            payment_status: "pending".into(),
            notes: None,
            extra_fields: BTreeMap::new(),
        }
    }

    #[test]
    fn accepts_valid_booking() {
        assert!(sample().validate().is_ok());
    }

    #[test]
    fn accepts_same_day_booking_as_canonical_contract_requires() {
        let mut booking = sample();
        booking.end_date = booking.start_date.clone();
        assert!(booking.validate().is_ok());
    }

    #[test]
    fn rejects_end_date_before_start_date() {
        let mut booking = sample();
        booking.end_date = "2026-11-20".into();
        assert!(booking.validate().unwrap_err().contains("before"));
    }

    #[test]
    fn preserves_newer_typescript_booking_fields() {
        let source = serde_json::json!({
            "id": "b-2",
            "resourceId": "r-2",
            "resourceName": "202",
            "sector": "hotel",
            "guestName": "Guest",
            "guestEmail": "",
            "guestPhone": "",
            "startDate": "2026-11-21",
            "endDate": "2026-11-21",
            "status": "confirmed",
            "totalPriceMinor": 120000,
            "currencyCode": "DZD",
            "paymentStatus": "pending",
            "notes": null,
            "adults": 2,
            "children": 1,
            "occupantsList": [{"id":"adult-1","fullName":"Guest"}],
            "extras": [{"label":"Breakfast","amount":1200}],
            "guestAgeBracket": "adult",
            "clientSegment": "business"
        });
        let booking: Booking = serde_json::from_value(source).unwrap();
        assert!(booking.validate().is_ok());
        assert_eq!(booking.extra_fields["adults"], 2);
        assert_eq!(booking.extra_fields["children"], 1);
        assert_eq!(booking.extra_fields["occupantsList"][0]["fullName"], "Guest");
        let round_trip = serde_json::to_value(booking).unwrap();
        assert_eq!(round_trip["resourceId"], "r-2");
        assert_eq!(round_trip["startDate"], "2026-11-21");
        assert_eq!(round_trip["extras"][0]["label"], "Breakfast");
        assert_eq!(round_trip["guestAgeBracket"], "adult");
        assert!(round_trip.get("resource_id").is_none());
    }

    #[test]
    fn preserves_typescript_money_until_currency_conversion_is_defined() {
        let source = serde_json::json!({
            "id": "b-3",
            "resourceId": "r-3",
            "resourceName": "303",
            "sector": "resort",
            "guestName": "Guest",
            "guestEmail": "",
            "guestPhone": "",
            "startDate": "2026-11-21",
            "endDate": "2026-11-22",
            "status": "confirmed",
            "paymentStatus": "pending",
            "totalPrice": 123.45,
            "paymentCurrency": "EUR",
            "notes": null
        });
        let booking: Booking = serde_json::from_value(source).unwrap();
        assert!(booking.validate().is_ok());
        assert_eq!(booking.total_price_minor, None);
        assert_eq!(booking.currency_code, None);
        let round_trip = serde_json::to_value(booking).unwrap();
        assert_eq!(round_trip["totalPrice"], 123.45);
        assert_eq!(round_trip["paymentCurrency"], "EUR");
    }

    #[test]
    fn rejects_partial_native_money_pair() {
        let mut booking = sample();
        booking.currency_code = None;
        assert!(booking.validate().unwrap_err().contains("provided together"));
    }

    #[test]
    fn rejects_negative_money() {
        let mut booking = sample();
        booking.total_price_minor = Some(-1);
        assert!(booking.validate().unwrap_err().contains("non-negative"));
    }

    #[test]
    fn rejects_impossible_calendar_date() {
        let mut booking = sample();
        booking.start_date = "2026-02-29".into();
        assert!(booking.validate().unwrap_err().contains("YYYY-MM-DD"));
    }
}
