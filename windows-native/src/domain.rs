use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum BookingStatus {
    #[default]
    New, Confirmed, DueIn, CheckedIn, DueOut, CheckedOut, BookingOffer, OutOfOrder, Cancelled,
}

impl BookingStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::New => "new", Self::Confirmed => "confirmed", Self::DueIn => "due_in",
            Self::CheckedIn => "checked_in", Self::DueOut => "due_out", Self::CheckedOut => "checked_out",
            Self::BookingOffer => "booking_offer", Self::OutOfOrder => "out_of_order",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookingOccupant {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_adult: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_primary: Option<bool>,
    #[serde(default)]
    pub full_name: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub document_type: String,
    #[serde(default)]
    pub document_number: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_expiry_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_doc: Option<String>,
    #[serde(flatten, default)]
    pub extra_fields: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookingExtra {
    pub label: String,
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookingPayment {
    pub amount: f64,
    pub method: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ValuableAtReception {
    pub id: String,
    pub description: String,
    pub status: String,
    pub recorded_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub returned_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ForgottenItem {
    pub id: String,
    pub description: String,
    pub status: String,
    pub found_at: String,
    pub found_by: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub returned_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GuestAlert {
    pub id: String,
    pub text: String,
    pub source: String,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookingModification {
    pub timestamp: String,
    pub modified_by: String,
    pub changes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Booking {
    pub id: String,
    #[serde(alias = "resource_id")]
    pub resource_id: String,
    #[serde(alias = "resource_name")]
    pub resource_name: String,
    pub sector: String,
    #[serde(alias = "guest_name")]
    pub guest_name: String,
    #[serde(alias = "guest_email")]
    pub guest_email: String,
    #[serde(alias = "guest_phone")]
    pub guest_phone: String,
    #[serde(alias = "start_date")]
    pub start_date: String,
    #[serde(alias = "end_date")]
    pub end_date: String,
    pub status: BookingStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_price: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_currency: Option<String>,
    // Legacy native-only fields are retained for already persisted local records.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_price_minor: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency_code: Option<String>,
    #[serde(alias = "payment_status")]
    pub payment_status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub check_in_time: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub check_out_time: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actual_check_out_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meal_plan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin_channel: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adults: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adult_guests: Option<Vec<BookingOccupant>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub children: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extras: Option<Vec<BookingExtra>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payments: Option<Vec<BookingPayment>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nationality: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guest_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_piece_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_piece_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub special_authorization_desc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wilaya: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meal_plan_diet_preferences: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_modified_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_modified_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modification_history: Option<Vec<BookingModification>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passport_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visa_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_document_expiry_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub visa_expiry_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entry_date_in_country: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wilaya_of_origin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_currency_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency_rate_to_dzd: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_method_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub occupants_list: Option<Vec<BookingOccupant>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valuables_at_reception: Option<Vec<ValuableAtReception>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forgotten_items: Option<Vec<ForgottenItem>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guest_alerts: Option<Vec<GuestAlert>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_metadata: Option<BTreeMap<String, Value>>,
    #[serde(flatten, default)]
    pub extra_fields: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MinorMoney {
    pub amount_minor: i64,
    pub currency_code: String,
    pub exponent: u8,
}

impl Booking {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty() { return Err("booking.id is required".into()); }
        if self.resource_id.trim().is_empty() { return Err("booking.resource_id is required".into()); }
        if !valid_date(&self.start_date) || !valid_date(&self.end_date) {
            return Err("booking dates must use YYYY-MM-DD".into());
        }
        if self.end_date < self.start_date {
            return Err("booking.end_date must not be before booking.start_date".into());
        }
        if !matches!(self.sector.as_str(), "hotel" | "resort") {
            return Err("booking.sector must be hotel or resort".into());
        }
        if !matches!(self.payment_status.as_str(), "paid" | "pending" | "partial") {
            return Err("booking.payment_status must be paid, pending or partial".into());
        }
        if self.total_price.is_some_and(|amount| !amount.is_finite() || amount < 0.0) {
            return Err("booking.totalPrice must be finite and non-negative".into());
        }
        match (self.total_price_minor, self.currency_code.as_deref()) {
            (Some(amount), Some(code)) if amount >= 0 && canonical_currency(code).is_some() => {}
            (None, None) => {}
            (Some(_), Some(_)) => return Err("legacy native minor amount or currency code is invalid".into()),
            _ => return Err("legacy native minor-unit amount and currency code must be provided together".into()),
        }
        let mut normalized = self.clone();
        normalized.normalize_occupants();
        if normalized.guest_name.trim().chars().count() < 2 {
            return Err("booking.guest_name must contain at least two characters".into());
        }
        normalized.validate_occupants()
    }

    /// Convert the TypeScript major-unit amount only for currencies with a declared exponent.
    /// The supported PMS currencies (DZD/DA, EUR, USD, RMB/CNY, GBP, SAR) all use exponent 2.
    pub fn normalized_total_money(&self) -> Result<Option<MinorMoney>, String> {
        if let Some(amount) = self.total_price {
            if !amount.is_finite() || amount < 0.0 {
                return Err("booking.totalPrice must be finite and non-negative".into());
            }
            let raw_code = self.payment_currency.as_deref().unwrap_or("DA");
            let (code, exponent) = canonical_currency(raw_code)
                .ok_or_else(|| format!("unsupported currency exponent for '{raw_code}'"))?;
            let factor = 10_f64.powi(i32::from(exponent));
            let scaled = (amount * factor).round();
            if !scaled.is_finite() || scaled > i64::MAX as f64 {
                return Err("booking.totalPrice exceeds the supported minor-unit range".into());
            }
            return Ok(Some(MinorMoney {
                amount_minor: scaled as i64, currency_code: code.to_string(), exponent,
            }));
        }
        match (self.total_price_minor, self.currency_code.as_deref()) {
            (Some(amount_minor), Some(raw_code)) => {
                let (code, exponent) = canonical_currency(raw_code)
                    .ok_or_else(|| format!("unsupported legacy currency code '{raw_code}'"))?;
                Ok(Some(MinorMoney { amount_minor, currency_code: code.to_string(), exponent }))
            }
            (None, None) => Ok(None),
            _ => Err("legacy native amount and currency code must be provided together".into()),
        }
    }

    /// Normalize adult/child slots using the same precedence and defaults as the TypeScript client.
    pub fn normalize_occupants(&mut self) {
        let metadata = self.custom_metadata.as_ref();
        let meta_adults = if self.sector == "resort" {
            json_count(metadata, "resortOccupants").or_else(|| json_count(metadata, "hotelAdults"))
        } else {
            json_count(metadata, "hotelAdults").or_else(|| json_count(metadata, "resortOccupants"))
        };
        let adults_count = self.adults.or(meta_adults).unwrap_or(1).max(1) as usize;
        let children_count = if self.sector == "resort" {
            self.children.unwrap_or(0).max(0) as usize
        } else {
            self.children.or_else(|| json_count(metadata, "hotelChildren"))
                .unwrap_or(0).max(0) as usize
        };

        let raw_adults = self.adult_guests.clone().unwrap_or_default();
        let raw_occupants = self.occupants_list.clone().unwrap_or_default();
        let occupant_adults: Vec<_> = raw_occupants.iter()
            .filter(|item| item.role.as_deref() != Some("child") && item.is_adult != Some(false))
            .cloned().collect();
        let occupant_children: Vec<_> = raw_occupants.iter()
            .filter(|item| item.role.as_deref() == Some("child") || item.is_adult == Some(false))
            .cloned().collect();
        let adult_entries: Vec<_> = raw_adults.iter()
            .filter(|item| item.role.as_deref() != Some("child") && item.is_adult != Some(false))
            .cloned().collect();
        let child_entries: Vec<_> = raw_adults.iter()
            .filter(|item| item.role.as_deref() == Some("child") || item.is_adult == Some(false))
            .cloned().collect();

        let first = adult_entries.first().or_else(|| occupant_adults.first());
        let mut primary = first.cloned().unwrap_or_default();
        primary.full_name = first_nonempty(&[
            Some(self.guest_name.as_str()), first.map(|item| item.full_name.as_str()),
            first.and_then(|item| item.name.as_deref()),
        ]);
        primary.phone = first_nonempty(&[Some(self.guest_phone.as_str()), first.map(|item| item.phone.as_str())]);
        primary.email = first_nonempty(&[Some(self.guest_email.as_str()), first.map(|item| item.email.as_str())]);
        let primary_doc_number = first_nonempty(&[
            self.id_piece_number.as_deref(), self.identity_number.as_deref(), self.passport_number.as_deref(),
        ]);
        if !primary_doc_number.is_empty() {
            primary.document_type = self.id_piece_type.as_deref()
                .filter(|value| !value.trim().is_empty()).unwrap_or("cni").to_string();
            primary.document_number = primary_doc_number;
        } else {
            primary.document_type = first.map(|item| item.document_type.as_str())
                .filter(|value| !value.trim().is_empty()).unwrap_or("cni").to_string();
            primary.document_number = first.map(|item| item.document_number.clone()).unwrap_or_default();
            if primary.document_number.is_empty() {
                primary.document_number = parse_legacy_id_doc(first.and_then(|item| item.id_doc.as_deref())).1;
            }
        }
        primary.document_expiry_date = self.id_document_expiry_date.clone()
            .or_else(|| first.and_then(|item| item.document_expiry_date.clone()));
        let mut adults = vec![normalize_occupant_slot(primary, 0, "adult", true)];
        for index in 1..adults_count {
            adults.push(normalize_occupant_slot(
                merge_occupants(adult_entries.get(index), occupant_adults.get(index)),
                index, "adult", false,
            ));
        }
        let child_source = if !occupant_children.is_empty() { &occupant_children } else { &child_entries };
        let mut children = Vec::with_capacity(children_count);
        for index in 0..children_count {
            children.push(normalize_occupant_slot(
                child_source.get(index).cloned().unwrap_or_default(),
                adults_count + index, "child", false,
            ));
        }
        if let Some(primary) = adults.first() {
            self.guest_name = first_nonempty(&[Some(self.guest_name.as_str()), Some(primary.full_name.as_str())]);
            self.guest_phone = first_nonempty(&[Some(self.guest_phone.as_str()), Some(primary.phone.as_str())]);
            self.guest_email = first_nonempty(&[Some(self.guest_email.as_str()), Some(primary.email.as_str())]);
        }
        self.adults = Some(adults_count as i64);
        self.children = Some(children_count as i64);
        self.adult_guests = Some(adults.clone());
        self.occupants_list = Some(adults.into_iter().chain(children).collect());
        if let Some(meta) = self.custom_metadata.as_mut() {
            if self.sector == "resort" {
                meta.insert("resortOccupants".into(), Value::from(adults_count as u64));
            } else if self.sector == "hotel" {
                meta.insert("hotelAdults".into(), Value::from(adults_count as u64));
                meta.insert("hotelChildren".into(), Value::from(children_count as u64));
            }
        }
    }

    fn validate_occupants(&self) -> Result<(), String> {
        let occupants = self.occupants_list.as_deref().unwrap_or(&[]);
        if occupants.is_empty() { return Err("booking must contain a primary occupant".into()); }
        if occupants.len() == 1 {
            let primary = &occupants[0];
            if primary.full_name.trim().chars().count() < 2 {
                return Err("primary guest full name is required".into());
            }
            if !primary.email.trim().is_empty() && !valid_email(&primary.email) {
                return Err("primary guest email is invalid".into());
            }
            if !primary.phone.trim().is_empty() && !valid_phone(&primary.phone) {
                return Err("primary guest phone is invalid".into());
            }
            return Ok(());
        }
        for (index, occupant) in occupants.iter().enumerate() {
            if occupant.full_name.trim().chars().count() < 2 {
                return Err(format!("booking occupant {} requires a full name", index + 1));
            }
            if occupant.document_type.trim().is_empty() {
                return Err(format!("booking occupant {} requires a document type", index + 1));
            }
            if occupant.document_number.trim().chars().count() < 2 {
                return Err(format!("booking occupant {} requires an identity document number", index + 1));
            }
            if !occupant.email.trim().is_empty() && !valid_email(&occupant.email) {
                return Err(format!("booking occupant {} has an invalid email", index + 1));
            }
            if index == 0 {
                if !valid_phone(&occupant.phone) {
                    return Err("multi-person booking requires a valid primary guest phone".into());
                }
            } else if !occupant.phone.trim().is_empty() && !valid_phone(&occupant.phone) {
                return Err(format!("booking occupant {} has an invalid phone", index + 1));
            }
        }
        if self.id_piece_type.as_deref() == Some("special_authorization")
            && self.special_authorization_desc.as_deref().unwrap_or("").trim().is_empty()
        {
            return Err("special authorization description is required".into());
        }
        Ok(())
    }
}

fn canonical_currency(raw: &str) -> Option<(&'static str, u8)> {
    match raw.trim().to_ascii_uppercase().as_str() {
        "DA" | "DZD" => Some(("DZD", 2)), "EUR" => Some(("EUR", 2)), "USD" => Some(("USD", 2)),
        "RMB" | "CNY" => Some(("CNY", 2)), "GBP" => Some(("GBP", 2)), "SAR" => Some(("SAR", 2)),
        _ => None,
    }
}

fn json_count(metadata: Option<&BTreeMap<String, Value>>, key: &str) -> Option<i64> {
    let value = metadata?.get(key)?;
    value.as_i64()
        .or_else(|| value.as_f64().map(|number| number.floor() as i64))
        .or_else(|| value.as_str()?.trim().parse::<f64>().ok().map(|number| number.floor() as i64))
}

fn first_nonempty(values: &[Option<&str>]) -> String {
    values.iter().flatten().find(|value| !value.trim().is_empty())
        .map(|value| value.trim().to_string()).unwrap_or_default()
}

fn parse_legacy_id_doc(value: Option<&str>) -> (String, String) {
    let raw = value.unwrap_or("").trim();
    if let Some((prefix, number)) = raw.split_once(':') {
        if !prefix.trim().is_empty() && !number.trim().is_empty() {
            return (prefix.trim().to_ascii_lowercase(), number.trim().to_string());
        }
    }
    ("cni".into(), raw.to_string())
}

fn normalize_occupant_slot(mut occupant: BookingOccupant, index: usize, role: &str, is_primary: bool) -> BookingOccupant {
    if occupant.full_name.trim().is_empty() {
        occupant.full_name = occupant.name.clone().unwrap_or_default().trim().to_string();
    } else {
        occupant.full_name = occupant.full_name.trim().to_string();
    }
    if occupant.document_number.trim().is_empty() {
        occupant.document_number = parse_legacy_id_doc(occupant.id_doc.as_deref()).1;
    }
    if occupant.document_type.trim().is_empty() {
        occupant.document_type = parse_legacy_id_doc(occupant.id_doc.as_deref()).0;
    }
    if occupant.document_type.trim().is_empty() { occupant.document_type = "cni".into(); }
    occupant.id = Some(occupant.id.filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{role}-{}", index + 1)));
    occupant.role = Some(role.into());
    occupant.is_adult = Some(role == "adult");
    occupant.is_primary = Some(is_primary);
    occupant.name = Some(occupant.full_name.clone());
    occupant.phone = occupant.phone.trim().to_string();
    occupant.email = occupant.email.trim().to_string();
    occupant.document_type = occupant.document_type.trim().to_ascii_lowercase();
    occupant.document_number = occupant.document_number.trim().to_string();
    occupant.document_expiry_date = occupant.document_expiry_date.filter(|value| !value.trim().is_empty());
    occupant.id_doc = if !occupant.document_number.is_empty() {
        Some(format!("{}:{}", occupant.document_type, occupant.document_number))
    } else {
        occupant.id_doc.filter(|value| !value.trim().is_empty())
    };
    occupant
}

fn merge_occupants(preferred: Option<&BookingOccupant>, fallback: Option<&BookingOccupant>) -> BookingOccupant {
    let preferred = preferred.cloned().unwrap_or_default();
    let fallback = fallback.cloned().unwrap_or_default();
    BookingOccupant {
        id: preferred.id.or(fallback.id),
        role: preferred.role.or(fallback.role),
        is_adult: preferred.is_adult.or(fallback.is_adult),
        is_primary: preferred.is_primary.or(fallback.is_primary),
        full_name: first_nonempty(&[
            Some(preferred.full_name.as_str()), preferred.name.as_deref(),
            Some(fallback.full_name.as_str()), fallback.name.as_deref(),
        ]),
        phone: first_nonempty(&[Some(preferred.phone.as_str()), Some(fallback.phone.as_str())]),
        email: first_nonempty(&[Some(preferred.email.as_str()), Some(fallback.email.as_str())]),
        document_type: first_nonempty(&[Some(preferred.document_type.as_str()), Some(fallback.document_type.as_str())]),
        document_number: first_nonempty(&[Some(preferred.document_number.as_str()), Some(fallback.document_number.as_str())]),
        document_expiry_date: preferred.document_expiry_date.or(fallback.document_expiry_date),
        name: preferred.name.or(fallback.name),
        id_doc: preferred.id_doc.or(fallback.id_doc),
        extra_fields: fallback.extra_fields.into_iter().chain(preferred.extra_fields).collect(),
    }
}

fn valid_email(value: &str) -> bool {
    let value = value.trim();
    let Some((local, domain)) = value.split_once('@') else { return false };
    !local.is_empty() && domain.contains('.') && !value.chars().any(char::is_whitespace)
        && domain.rsplit('.').next().is_some_and(|suffix| suffix.len() >= 2)
}

fn valid_phone(value: &str) -> bool {
    let trimmed = value.trim();
    let digits = trimmed.chars().filter(|character| character.is_ascii_digit()).count();
    trimmed.chars().count() >= 6 && digits >= 6
}

fn valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' { return false; }
    if !bytes.iter().enumerate().all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit()) {
        return false;
    }
    let year: u32 = value[0..4].parse().unwrap_or(0);
    let month: u32 = value[5..7].parse().unwrap_or(0);
    let day: u32 = value[8..10].parse().unwrap_or(0);
    let leap = year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31, 4 | 6 | 9 | 11 => 30,
        2 if leap => 29, 2 => 28, _ => return false,
    };
    (1..=days_in_month).contains(&day)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Booking {
        Booking {
            id: "b-1".into(), resource_id: "r-1".into(), resource_name: "101".into(),
            sector: "hotel".into(), guest_name: "Guest".into(), guest_email: "".into(),
            guest_phone: "".into(), start_date: "2026-11-21".into(), end_date: "2026-11-23".into(),
            status: BookingStatus::Confirmed, total_price: Some(12_000.0),
            payment_currency: Some("DZD".into()), payment_status: "pending".into(),
            ..Booking::default()
        }
    }

    #[test]
    fn accepts_valid_booking_and_same_day_date_range() {
        assert!(sample().validate().is_ok());
        let mut same_day = sample(); same_day.end_date = same_day.start_date.clone();
        assert!(same_day.validate().is_ok());
    }

    #[test]
    fn rejects_reversed_and_impossible_dates() {
        let mut booking = sample(); booking.end_date = "2026-11-20".into();
        assert!(booking.validate().unwrap_err().contains("before"));
        booking.end_date = "2026-11-23".into(); booking.start_date = "2026-02-29".into();
        assert!(booking.validate().unwrap_err().contains("YYYY-MM-DD"));
    }

    #[test]
    fn normalizes_all_adults_and_children_without_fabricating_contacts() {
        let source = serde_json::json!({
            "id":"family-1","resourceId":"r-1","resourceName":"101","sector":"hotel",
            "guestName":"Karim Benali","guestEmail":"","guestPhone":"+213 550 11 22 33",
            "startDate":"2026-11-21","endDate":"2026-11-22","status":"confirmed",
            "totalPrice":450.0,"paymentCurrency":"DZD","paymentStatus":"pending",
            "adults":2,"children":1,
            "adultGuests":[{"name":"Karim Benali","idDoc":"cni:1002003004"},{"name":"Salima Benali","idDoc":"cni:2003004005"}],
            "occupantsList":[
              {"id":"primary","role":"adult","isPrimary":true,"fullName":"Karim Benali","documentType":"cni","documentNumber":"1002003004"},
              {"id":"adult-2","role":"adult","isAdult":true,"fullName":"Salima Benali","documentType":"cni","documentNumber":"2003004005"},
              {"id":"child-3","role":"child","isAdult":false,"fullName":"Adam Benali","documentType":"passport","documentNumber":"P112233"}
            ],
            "customMetadata":{"hotelAdults":2,"hotelChildren":1,"vipNote":"sea view"}
        });
        let mut booking: Booking = serde_json::from_value(source).unwrap();
        booking.normalize_occupants();
        assert!(booking.validate().is_ok());
        let occupants = booking.occupants_list.as_ref().unwrap();
        assert_eq!(occupants.len(), 3);
        assert_eq!(occupants[0].full_name, "Karim Benali");
        assert_eq!(occupants[1].full_name, "Salima Benali");
        assert_eq!(occupants[2].role.as_deref(), Some("child"));
        assert_eq!(occupants[1].phone, "");
        assert_eq!(occupants[2].email, "");
        assert_eq!(booking.custom_metadata.as_ref().unwrap()["vipNote"], "sea view");
    }

    #[test]
    fn multi_person_booking_requires_identity_for_every_person_and_primary_phone() {
        let mut booking = sample(); booking.adults = Some(2);
        booking.adult_guests = Some(vec![
            BookingOccupant {
                full_name:"Primary Guest".into(), phone:"+213 550 11 22 33".into(),
                document_type:"cni".into(), document_number:"12345678".into(),
                ..BookingOccupant::default()
            },
            BookingOccupant {
                full_name:"Second Guest".into(), document_type:"cni".into(),
                document_number:"87654321".into(), ..BookingOccupant::default()
            },
        ]);
        assert!(booking.validate().is_ok());
        booking.adult_guests.as_mut().unwrap()[1].document_number.clear();
        assert!(booking.validate().unwrap_err().contains("identity document"));
    }

    #[test]
    fn currency_exponents_and_aliases_are_explicit() {
        for (currency, canonical) in [
            ("DZD","DZD"),("DA","DZD"),("EUR","EUR"),("USD","USD"),
            ("RMB","CNY"),("CNY","CNY"),("GBP","GBP"),("SAR","SAR"),
        ] {
            let mut booking = sample(); booking.payment_currency = Some(currency.into());
            let money = booking.normalized_total_money().unwrap().unwrap();
            assert_eq!(money.currency_code, canonical); assert_eq!(money.exponent, 2);
            assert_eq!(money.amount_minor, 1_200_000);
        }
    }

    #[test]
    fn rounds_major_units_and_refuses_unknown_currency_conversion() {
        let mut booking = sample(); booking.total_price = Some(12.345);
        assert_eq!(booking.normalized_total_money().unwrap().unwrap().amount_minor, 1235);
        booking.payment_currency = Some("XYZ".into());
        assert!(booking.normalized_total_money().unwrap_err().contains("unsupported currency"));
        assert!(booking.validate().is_ok());
    }

    #[test]
    fn preserves_unknown_typescript_fields_and_legacy_snake_case_payloads() {
        let source = serde_json::json!({
            "id":"legacy-1","resource_id":"r-1","resource_name":"202","sector":"resort",
            "guest_name":"Guest","guest_email":"","guest_phone":"",
            "start_date":"2026-11-21","end_date":"2026-11-21","status":"confirmed",
            "total_price":125.0,"payment_currency":"EUR","payment_status":"pending",
            "futureField":{"nested":true},"guestAgeBracket":"adult"
        });
        let booking: Booking = serde_json::from_value(source).unwrap();
        assert!(booking.validate().is_ok());
        let round_trip = serde_json::to_value(booking).unwrap();
        assert_eq!(round_trip["resourceId"], "r-1");
        assert_eq!(round_trip["futureField"]["nested"], true);
        assert_eq!(round_trip["guestAgeBracket"], "adult");
        assert_eq!(round_trip["totalPrice"], 125.0);
        assert!(round_trip.get("resource_id").is_none());
    }

    #[test]
    fn preserves_legacy_native_minor_unit_records() {
        let source = serde_json::json!({
            "id":"native-old","resourceId":"r-1","resourceName":"101","sector":"hotel",
            "guestName":"Guest","guestEmail":"","guestPhone":"",
            "startDate":"2026-11-21","endDate":"2026-11-22","status":"confirmed",
            "totalPriceMinor":12345,"currencyCode":"DZD","paymentStatus":"pending"
        });
        let booking: Booking = serde_json::from_value(source).unwrap();
        assert!(booking.validate().is_ok());
        assert_eq!(booking.normalized_total_money().unwrap().unwrap().amount_minor, 12345);
        let round_trip = serde_json::to_value(booking).unwrap();
        assert_eq!(round_trip["totalPriceMinor"], 12345);
    }
}
