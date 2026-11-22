use crate::domain::Booking;
use serde_json::{json, Map, Value};

const PMS_FIELDS: &[&str] = &[
    "color", "checkInTime", "checkOutTime", "actualCheckOutAt", "guestType",
    "nationality", "idType", "identityType", "identityNumber", "idPieceType",
    "idPieceNumber", "specialAuthorizationDesc", "wilaya", "wilayaOfOrigin",
    "passportNumber", "visaNumber", "idDocumentExpiryDate", "visaExpiryDate",
    "entryDateInCountry", "mealPlanDietPreferences", "valuablesAtReception",
    "forgottenItems", "guestAlerts", "lastModifiedAt", "lastModifiedBy",
    "modificationHistory",
];

/// Map the local canonical booking to the verified public.bookings Insert shape.
/// Tenant identifiers are explicit and mandatory; this mapper never selects a default workspace.
pub fn to_supabase_booking_row(
    raw_booking: &Booking,
    workspace_id: &str,
    establishment_id: &str,
    created_by: Option<&str>,
) -> Result<Value, String> {
    if workspace_id.trim().is_empty() || establishment_id.trim().is_empty() {
        return Err("workspace_id and establishment_id are required".into());
    }

    let mut booking = raw_booking.clone();
    booking.normalize_occupants();
    booking.validate()?;
    let total_price = booking.total_price
        .ok_or_else(|| "booking.totalPrice is required for Supabase persistence".to_string())?;
    let currency = booking.payment_currency.as_deref().unwrap_or("DA").trim();
    let currency = if currency.is_empty() { "DA" } else { currency };

    let serialized = serde_json::to_value(&booking).map_err(|error| error.to_string())?;
    let mut pms = Map::new();
    for key in PMS_FIELDS {
        if let Some(value) = serialized.get(*key).filter(|value| !value.is_null()) {
            pms.insert((*key).to_string(), value.clone());
        }
    }

    let mut guest_metadata = Map::new();
    if let Some(custom) = booking.custom_metadata.as_ref() {
        for (key, value) in custom {
            if key != "_pms" {
                guest_metadata.insert(key.clone(), value.clone());
            }
        }
        if let Some(Value::Object(existing)) = custom.get("_pms") {
            for (key, value) in existing {
                pms.entry(key.clone()).or_insert_with(|| value.clone());
            }
        }
    }
    if !pms.is_empty() {
        guest_metadata.insert("_pms".into(), Value::Object(pms));
    }

    let mut payments_summary = Map::new();
    payments_summary.insert("paymentCurrency".into(), json!(currency));
    if let Some(value) = booking.original_currency_amount {
        payments_summary.insert("originalCurrencyAmount".into(), json!(value));
    }
    if let Some(value) = booking.currency_rate_to_dzd {
        payments_summary.insert("currencyRateToDzd".into(), json!(value));
    }
    if let Some(value) = booking.payment_method_type.as_ref() {
        payments_summary.insert("paymentMethodType".into(), json!(value));
    }
    payments_summary.insert("payments".into(), json!(booking.payments.clone().unwrap_or_default()));

    Ok(json!({
        "id": booking.id,
        "workspace_id": workspace_id,
        "establishment_id": establishment_id,
        "resource_id": booking.resource_id,
        "domain": booking.sector,
        "resource_name": booking.resource_name,
        "guest_name": booking.guest_name,
        "guest_email": nullable_trimmed(&booking.guest_email),
        "guest_phone": nullable_trimmed(&booking.guest_phone),
        "start_date": booking.start_date,
        "end_date": booking.end_date,
        "status": booking.status.as_str(),
        "total_price": total_price,
        "payment_status": booking.payment_status,
        "currency": currency,
        "payments_summary": Value::Object(payments_summary),
        "adults": booking.adults.unwrap_or(1).max(1),
        "children": booking.children.unwrap_or(0).max(0),
        "notes": booking.notes,
        "meal_plan": booking.meal_plan,
        "origin_channel": booking.origin_channel,
        "extras": booking.extras.unwrap_or_default(),
        "occupants": booking.occupants_list.unwrap_or_default(),
        "guest_metadata": Value::Object(guest_metadata),
        "created_by": created_by,
    }))
}

/// Restore a TypeScript-compatible local booking from a public.bookings row.
pub fn from_supabase_booking_row(row: &Value) -> Result<Booking, String> {
    let row = row.as_object()
        .ok_or_else(|| "Supabase booking row must be an object".to_string())?;
    let guest_metadata = object_or_empty(row.get("guest_metadata"));
    let pms = object_or_empty(guest_metadata.get("_pms"));
    let payments_summary = object_or_empty(row.get("payments_summary"));

    let mut custom_metadata = guest_metadata.clone();
    custom_metadata.remove("_pms");

    let payment_currency = payments_summary.get("paymentCurrency")
        .and_then(Value::as_str)
        .or_else(|| row.get("currency").and_then(Value::as_str))
        .unwrap_or("DA");
    let total_price = row.get("total_price").and_then(Value::as_f64)
        .ok_or_else(|| "Supabase booking row is missing numeric total_price".to_string())?;

    let mut payload = json!({
        "id": required_string(row, "id")?,
        "resourceId": required_string(row, "resource_id")?,
        "resourceName": required_string(row, "resource_name")?,
        "sector": required_string(row, "domain")?,
        "guestName": row.get("guest_name").and_then(Value::as_str).unwrap_or(""),
        "guestEmail": row.get("guest_email").and_then(Value::as_str).unwrap_or(""),
        "guestPhone": row.get("guest_phone").and_then(Value::as_str).unwrap_or(""),
        "startDate": required_string(row, "start_date")?,
        "endDate": required_string(row, "end_date")?,
        "status": required_string(row, "status")?,
        "totalPrice": total_price,
        "paymentCurrency": payment_currency,
        "paymentStatus": row.get("payment_status").and_then(Value::as_str).unwrap_or("pending"),
        "notes": row.get("notes").cloned().unwrap_or(Value::Null),
        "mealPlan": row.get("meal_plan").cloned().unwrap_or(Value::Null),
        "originChannel": row.get("origin_channel").cloned().unwrap_or(Value::Null),
        "adults": row.get("adults").and_then(Value::as_i64).unwrap_or(1),
        "children": row.get("children").and_then(Value::as_i64).unwrap_or(0),
        "extras": row.get("extras").filter(|value| !value.is_null()).cloned().unwrap_or_else(|| json!([])),
        "occupantsList": row.get("occupants").filter(|value| !value.is_null()).cloned().unwrap_or_else(|| json!([])),
        "payments": payments_summary.get("payments").cloned().unwrap_or_else(|| json!([])),
        "originalCurrencyAmount": payments_summary.get("originalCurrencyAmount").cloned().unwrap_or(Value::Null),
        "currencyRateToDzd": payments_summary.get("currencyRateToDzd").cloned().unwrap_or(Value::Null),
        "paymentMethodType": payments_summary.get("paymentMethodType").cloned().unwrap_or(Value::Null),
        "customMetadata": Value::Object(custom_metadata),
    });

    if let Some(payload_object) = payload.as_object_mut() {
        for key in PMS_FIELDS {
            if let Some(value) = pms.get(*key) {
                payload_object.insert((*key).to_string(), value.clone());
            }
        }
    }
    let mut booking: Booking = serde_json::from_value(payload).map_err(|error| error.to_string())?;
    booking.normalize_occupants();
    // Reads remain lossless even for legacy rows that predate multi-occupant validation.
    Ok(booking)
}

fn nullable_trimmed(value: &str) -> Value {
    if value.trim().is_empty() { Value::Null } else { Value::String(value.trim().to_string()) }
}

fn object_or_empty(value: Option<&Value>) -> Map<String, Value> {
    value.and_then(Value::as_object).cloned().unwrap_or_default()
}

fn required_string(row: &Map<String, Value>, key: &str) -> Result<String, String> {
    row.get(key).and_then(Value::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Supabase booking row is missing string field '{key}'"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Booking, BookingExtra, BookingOccupant, BookingPayment, BookingStatus};

    fn sample() -> Booking {
        Booking {
            id: "b-1".into(),
            resource_id: "room-101".into(),
            resource_name: "101".into(),
            sector: "hotel".into(),
            guest_name: "Karim Benali".into(),
            guest_email: "karim@example.test".into(),
            guest_phone: "+213 550 11 22 33".into(),
            start_date: "2026-11-21".into(),
            end_date: "2026-11-24".into(),
            status: BookingStatus::Confirmed,
            total_price: Some(450.0),
            payment_currency: Some("EUR".into()),
            payment_status: "partial".into(),
            adults: Some(2),
            children: Some(1),
            adult_guests: Some(vec![
                BookingOccupant {
                    full_name: "Karim Benali".into(),
                    phone: "+213 550 11 22 33".into(),
                    email: "karim@example.test".into(),
                    document_type: "passport".into(),
                    document_number: "FR998877".into(),
                    ..BookingOccupant::default()
                },
                BookingOccupant {
                    full_name: "Salima Benali".into(),
                    email: "salima@example.test".into(),
                    document_type: "cni".into(),
                    document_number: "2003004005".into(),
                    ..BookingOccupant::default()
                },
            ]),
            occupants_list: Some(vec![
                BookingOccupant {
                    full_name: "Karim Benali".into(),
                    phone: "+213 550 11 22 33".into(),
                    email: "karim@example.test".into(),
                    document_type: "passport".into(),
                    document_number: "FR998877".into(),
                    is_primary: Some(true),
                    ..BookingOccupant::default()
                },
                BookingOccupant {
                    full_name: "Salima Benali".into(),
                    document_type: "cni".into(),
                    document_number: "2003004005".into(),
                    ..BookingOccupant::default()
                },
                BookingOccupant {
                    full_name: "Adam Benali".into(),
                    document_type: "passport".into(),
                    document_number: "P112233".into(),
                    is_adult: Some(false),
                    role: Some("child".into()),
                    ..BookingOccupant::default()
                },
            ]),
            extras: Some(vec![BookingExtra {
                label: "Breakfast".into(),
                amount: 25.0,
                category: Some("meal".into()),
            }]),
            payments: Some(vec![BookingPayment {
                amount: 200.0,
                method: "cash".into(),
                date: "2026-11-21".into(),
            }]),
            check_in_time: Some("14:00".into()),
            check_out_time: Some("12:00".into()),
            visa_number: Some("VISA-2026-44".into()),
            custom_metadata: Some([("vipNote".to_string(), json!("sea view"))].into_iter().collect()),
            ..Booking::default()
        }
    }

    #[test]
    fn maps_booking_to_verified_supabase_insert_shape() {
        let row = to_supabase_booking_row(&sample(), "ws-1", "est-1", Some("user-1")).unwrap();
        assert_eq!(row["workspace_id"], "ws-1");
        assert_eq!(row["establishment_id"], "est-1");
        assert_eq!(row["currency"], "EUR");
        assert_eq!(row["total_price"], 450.0);
        assert_eq!(row["occupants"].as_array().unwrap().len(), 3);
        assert_eq!(row["payments_summary"]["payments"][0]["amount"], 200.0);
        assert_eq!(row["guest_metadata"]["vipNote"], "sea view");
        assert_eq!(row["guest_metadata"]["_pms"]["visaNumber"], "VISA-2026-44");
        assert_eq!(row["guest_metadata"]["_pms"]["checkInTime"], "14:00");
    }

    #[test]
    fn maps_supabase_row_back_to_booking_and_keeps_metadata_separate() {
        let original = sample();
        let row = to_supabase_booking_row(&original, "ws-1", "est-1", None).unwrap();
        let restored = from_supabase_booking_row(&row).unwrap();
        assert_eq!(restored.id, original.id);
        assert_eq!(restored.total_price, original.total_price);
        assert_eq!(restored.payment_currency.as_deref(), Some("EUR"));
        assert_eq!(restored.adults, Some(2));
        assert_eq!(restored.children, Some(1));
        assert_eq!(restored.occupants_list.as_ref().unwrap().len(), 3);
        assert_eq!(restored.occupants_list.as_ref().unwrap()[2].full_name, "Adam Benali");
        assert_eq!(restored.payments.as_ref().unwrap()[0].amount, 200.0);
        assert_eq!(restored.visa_number.as_deref(), Some("VISA-2026-44"));
        assert_eq!(restored.custom_metadata.as_ref().unwrap()["vipNote"], "sea view");
        assert!(!restored.custom_metadata.as_ref().unwrap().contains_key("_pms"));
    }

    #[test]
    fn tenant_scope_is_never_implicit() {
        assert!(to_supabase_booking_row(&sample(), "", "est-1", None).is_err());
        assert!(to_supabase_booking_row(&sample(), "ws-1", "", None).is_err());
    }
}
