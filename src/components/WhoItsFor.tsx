import { User, Briefcase, Check } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

export default function WhoItsFor() {
  return (
    <section id="benefits" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-transparent transition-colors duration-500">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal direction="up" delay={50}>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[#172B43] dark:text-[#F4F7FA] tracking-tight">
              Peace of Mind for Both Sides
            </h2>
            <p className="mt-3 text-base text-[#526B82] dark:text-[#AAB7B5]">
              Clients don't get ghosted. Freelancers don't get underpaid.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Client Card */}
          <ScrollReveal direction="left" delay={150} className="h-full">
            <div className="h-full rounded-3xl border border-[#172B43]/10 dark:border-white/10 bg-white/80 dark:bg-[#131F33]/85 p-8 shadow-xl dark:shadow-2xl shadow-black/15 dark:shadow-black/50 backdrop-blur-xl flex flex-col justify-between transition-colors duration-300">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0E7490]/15 dark:bg-[#0E7490]/30 text-[#078FBE] dark:text-[#58C7E8] border border-[#078FBE]/20 dark:border-[#58C7E8]/30 font-bold shadow-md">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#172B43] dark:text-[#F4F7FA]">
                      If You Are Hiring
                    </h3>
                    <span className="text-xs text-[#078FBE] dark:text-[#58C7E8] font-semibold">
                      For Clients & Business Owners
                    </span>
                  </div>
                </div>

                <ul className="mt-6 space-y-4 text-sm text-[#526B82] dark:text-[#AAB7B5]">
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-[#172B24] text-[#078FBE] dark:text-[#58C7E8] border border-[#078FBE]/20 dark:border-[#58C7E8]/20 shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span><strong className="text-[#172B43] dark:text-[#F4F7FA]">Never pay 100% upfront:</strong> Pay in safe, bite-sized amounts as each stage is finished.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-[#172B24] text-[#078FBE] dark:text-[#58C7E8] border border-[#078FBE]/20 dark:border-[#58C7E8]/20 shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span><strong className="text-[#172B43] dark:text-[#F4F7FA]">No tech skills needed:</strong> AI inspects the work for you and alerts you if anything is missing.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-[#172B24] text-[#078FBE] dark:text-[#58C7E8] border border-[#078FBE]/20 dark:border-[#58C7E8]/20 shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span><strong className="text-[#172B43] dark:text-[#F4F7FA]">You stay in control:</strong> No payment is sent until you look at the work and tap Approve.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#172B43]/10 dark:border-white/10 text-xs font-bold text-[#078FBE] dark:text-[#58C7E8]">
                ✓ You only pay for real, verified results
              </div>
            </div>
          </ScrollReveal>

          {/* Freelancer Card */}
          <ScrollReveal direction="right" delay={250} className="h-full">
            <div className="h-full rounded-3xl border border-[#172B43]/10 dark:border-white/10 bg-white/80 dark:bg-[#131F33]/85 p-8 shadow-xl dark:shadow-2xl shadow-black/15 dark:shadow-black/50 backdrop-blur-xl flex flex-col justify-between transition-colors duration-300">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-[#0D281E]/40 text-emerald-600 dark:text-[#4ADE80] border border-emerald-500/20 dark:border-[#4ADE80]/30 font-bold shadow-md">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#172B43] dark:text-[#F4F7FA]">
                      If You Are Working
                    </h3>
                    <span className="text-xs text-emerald-600 dark:text-[#4ADE80] font-semibold">
                      For Freelancers & Contractors
                    </span>
                  </div>
                </div>

                <ul className="mt-6 space-y-4 text-sm text-[#526B82] dark:text-[#AAB7B5]">
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-[#0D281E] text-emerald-600 dark:text-[#4ADE80] border border-emerald-500/20 dark:border-[#4ADE80]/20 shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span><strong className="text-[#172B43] dark:text-[#F4F7FA]">Regular cashflow:</strong> Get paid as each milestone is completed instead of waiting months.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-[#0D281E] text-emerald-600 dark:text-[#4ADE80] border border-emerald-500/20 dark:border-[#4ADE80]/20 shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span><strong className="text-[#172B43] dark:text-[#F4F7FA]">Protected from scope creep:</strong> Clear agreed checklists prevent clients from demanding free extra work.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-[#0D281E] text-emerald-600 dark:text-[#4ADE80] border border-emerald-500/20 dark:border-[#4ADE80]/20 shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span><strong className="text-[#172B43] dark:text-[#F4F7FA]">Permanent proof of delivery:</strong> Official invoices and verified milestone trails for every job.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-[#172B43]/10 dark:border-white/10 text-xs font-bold text-emerald-600 dark:text-[#4ADE80]">
                ✓ Never chase invoices or deal with arbitrary chargebacks
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
