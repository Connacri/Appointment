use serde::{Deserialize, Serialize};

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
    pub resource_id: String,
    pub resource_name: String,
    pub sector: String,
    pub guest_name: String,
    pub guest_email: String,
    pub guest_phone: String,
    pub start_date: String,
    pub end_date: String,
    pub status: BookingStatus,
    pub total_price: f64,
    pub payment_status: String,
    pub notes: Option<String>,
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
        if self.end_date <= self.start_date {
            return Err("booking.end_date must be later than booking.start_date".into());
        }
        if !self.total_price.is_finite() || self.total_price < 0.0 {
            return Err("booking.total_price must be a finite non-negative amount".into());
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
    let month: u32 = value[5..7].parse().unwrap_or(0);
    let day: u32 = value[8..10].parse().unwrap_or(0);
    (1..=12).contains(&month) && (1..=31).contains(&day)
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
            total_price: 12000.0,
            payment_status: "pending".into(),
            notes: None,
        }
    }

    #[test]
    fn accepts_valid_booking() {
        assert!(sample().validate().is_ok());
    }

    #[test]
    fn rejects_non_positive_stay() {
        let mut booking = sample();
        booking.end_date = booking.start_date.clone();
        assert!(booking.validate().unwrap_err().contains("later"));
    }

    #[test]
    fn rejects_invalid_money() {
        let mut booking = sample();
        booking.total_price = f64::NAN;
        assert!(booking.validate().unwrap_err().contains("finite"));
    }
}
