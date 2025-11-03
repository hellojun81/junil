import { useEffect, useState } from "react";
import { getSettings } from "./admin";

export function CompanyName() {
  const [companyName, setCompanyName] = useState<string>("전일축산");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        console.log(s)
        if (s.company_name) setCompanyName(s.company_name);
      } catch (e) {
        console.error("회사명 로드 실패:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  console.log(companyName)
  return { companyName, loading };
}

export function useUnit() {
  const [unit, setUnit] = useState<string[]>([]);
  const [default_unit, setDefault_unit] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        console.log(s)
        if (s.units) setUnit(s.units);
        if (s.default_unit) setDefault_unit(s.default_unit);
      } catch (e) {
        console.error("회사명 로드 실패:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return { unit, default_unit };
}