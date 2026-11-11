import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";

export interface VisitFormValues {
  name: string;
  description: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  remarks: string;
}

export const EMPTY_VISIT_FORM: VisitFormValues = {
  name: "",
  description: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  remarks: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message for the first invalid optional field, else null. */
export function validateVisitForm(v: VisitFormValues): string | null {
  if (v.contactEmail.trim() && !EMAIL_RE.test(v.contactEmail.trim())) return "That email address doesn't look right.";
  if (v.contactPhone.trim() && v.contactPhone.replace(/\D/g, "").length < 6) return "That phone number looks too short.";
  return null;
}

/** The text fields for logging a visit — shared by the dashboard card and the map screen. */
export function VisitFormFields({
  values,
  onChange,
}: {
  values: VisitFormValues;
  onChange: (next: VisitFormValues) => void;
}) {
  const set = (key: keyof VisitFormValues) => (text: string) => onChange({ ...values, [key]: text });
  const [moreOpen, setMoreOpen] = useState(false);
  const showMore = moreOpen || !!(values.contactName || values.contactPhone || values.contactEmail);
  return (
    <>
      <TextField label="LOCATION NAME" placeholder="e.g. Sri Balaji Traders" value={values.name} onChangeText={set("name")} />
      <TextField
        label="DESCRIPTION (OPTIONAL)"
        placeholder="e.g. Met the owner, order follow-up needed"
        value={values.description}
        onChangeText={set("description")}
        multiline
        numberOfLines={3}
        maxLength={500}
        textAlignVertical="top"
        style={styles.multiline}
      />
      <Pressable
        onPress={() => setMoreOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showMore }}
        style={styles.moreToggle}
      >
        <Text style={styles.moreLabel}>Contact details (optional)</Text>
        <View style={{ transform: [{ rotate: showMore ? "180deg" : "0deg" }] }}>
          <Icon name="chevronDown" size={18} color={colors.textSecondary} />
        </View>
      </Pressable>
      {showMore ? (
        <>
      <TextField
        label="CONTACT PERSON"
        placeholder="Name of the person you met"
        value={values.contactName}
        onChangeText={set("contactName")}
        autoCapitalize="words"
        maxLength={120}
      />
      <TextField
        label="PHONE NUMBER"
        placeholder="e.g. 98765 43210"
        value={values.contactPhone}
        onChangeText={(t) => set("contactPhone")(t.replace(/[^0-9+\-\s()]/g, ""))}
        keyboardType="phone-pad"
        maxLength={30}
      />
      <TextField
        label="EMAIL ID"
        placeholder="name@company.com"
        value={values.contactEmail}
        onChangeText={set("contactEmail")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={160}
      />
        </>
      ) : null}
      <TextField
        label="REMARKS (OPTIONAL)"
        placeholder="Anything else worth noting"
        value={values.remarks}
        onChangeText={set("remarks")}
        multiline
        numberOfLines={3}
        maxLength={1000}
        textAlignVertical="top"
        style={styles.multiline}
      />
    </>
  );
}

/** Builds the API payload's optional text fields, omitting blanks. */
export function visitFormToPayload(v: VisitFormValues) {
  const clean = (s: string) => s.trim() || undefined;
  return {
    name: v.name.trim(),
    description: clean(v.description),
    contactName: clean(v.contactName),
    contactPhone: clean(v.contactPhone),
    contactEmail: clean(v.contactEmail),
    remarks: clean(v.remarks),
  };
}

const styles = StyleSheet.create({
  moreToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  moreLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: colors.ink },
  multiline: { minHeight: 76, marginBottom: spacing.xs },
});
