import type { Metadata } from 'next';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = {
  title: 'À Propos',
  description: "VIVA – Live Better Every Day : notre histoire, nos valeurs et l'équipe derrière la boutique.",
  alternates: { canonical: '/a-propos' },
};
export const revalidate = 60;

export default async function AboutPage() {
  const extra = await getContent('about'); // texte additionnel éditable depuis le back-office
  return (
    <>
            <div className="page-content relative bg-gradient-to-b from-sage-100/80 via-white to-sage-50/60 min-h-screen">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-fixed opacity-[0.05] pointer-events-none"></div>

                {/* Header Hero de la page À Propos */}
                <section className="relative bg-pine-900 text-white py-24 px-4 sm:px-6 lg:px-8 overflow-hidden shadow-xl">
                    <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80" 
                         alt="À Propos Background" 
                         className="absolute inset-0 w-full h-full object-cover opacity-25" />
                    <div className="absolute inset-0 bg-gradient-to-r from-pine-950 via-pine-900/95 to-pine-900/80"></div>
                
                    <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold px-4 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md">Notre Histoire & Philosophie</span>
                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">VIVA – Live Better Every Day</h1>
                        <p className="text-sage-200 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-medium">
                            Nous concevons et sélectionnons des produits d'exception pour réinventer vos routines quotidiennes dans l'harmonie, le style et la durabilité.
                        </p>
                    </div>
                </section>

                {/* Section 1 : Notre Histoire */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
                    <div className="grid lg:grid-cols-12 gap-12 items-center">
                        <div className="lg:col-span-6 space-y-6">
                            <div className="inline-flex items-center gap-2 bg-sage-200/80 text-pine-900 text-xs font-bold px-3.5 py-1 rounded-full">
                                <i className="fa-solid fa-seedling"></i> Depuis 2021
                            </div>
                            <h2 className="text-3xl font-extrabold text-pine-900 tracking-tight leading-tight">
                                Des objets inspirants conçus pour sublimer votre quotidien
                            </h2>
                            <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                Fondé avec la conviction profonde que la qualité de notre environnement influence directement notre bien-être, <strong>VIVA</strong> s'engage à réunir sur une seule plateforme le meilleur de la technologie, de la mode, de la décoration d'intérieur et des soins.
                            </p>
                            <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                Chaque référence figurant dans notre boutique fait l'objet de tests rigoureux pour vous garantir une expérience d'utilisation optimale et durable.
                            </p>
                        
                            <div className="pt-2 grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-white border border-sage-200 shadow-sm">
                                    <h4 className="font-extrabold text-pine-900 text-lg">100% Sélectionné</h4>
                                    <p className="text-xs text-gray-500 mt-1">Produits testés & certifiés conformes aux standards européens.</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-sage-200 shadow-sm">
                                    <h4 className="font-extrabold text-pine-900 text-lg">Éco-Conçu</h4>
                                    <p className="text-xs text-gray-500 mt-1">Matériaux responsables et emballages zéro déchet.</p>
                                </div>
                            </div>
                        </div>

                        {/* Grille Visuelle */}
                        <div className="lg:col-span-6 grid grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <img src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80" alt="Design intérieur VIVA" className="rounded-3xl shadow-lg w-full h-56 object-cover border border-white" />
                                <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80" alt="Produits de beauté VIVA" className="rounded-3xl shadow-lg w-full h-40 object-cover border border-white" />
                            </div>
                            <div className="space-y-4 pt-6">
                                <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80" alt="Technologie VIVA" className="rounded-3xl shadow-lg w-full h-40 object-cover border border-white" />
                                <img src="https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80" alt="Mode éthique VIVA" className="rounded-3xl shadow-lg w-full h-56 object-cover border border-white" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 2 : Key Metrics Banner */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 bg-pine-900 text-white p-8 sm:p-10 rounded-3xl shadow-2xl border border-pine-800 text-center relative overflow-hidden">
                        <div className="space-y-1 relative z-10 border-r border-pine-800/80 last:border-none">
                            <p className="text-4xl sm:text-5xl font-black text-emerald-400">120k+</p>
                            <p className="text-xs text-sage-200 font-extrabold uppercase tracking-wider">Clients Satisfaits</p>
                        </div>
                        <div className="space-y-1 relative z-10 border-r border-pine-800/80 last:border-none">
                            <p className="text-4xl sm:text-5xl font-black text-emerald-400">100%</p>
                            <p className="text-xs text-sage-200 font-extrabold uppercase tracking-wider">Qualité Contrôlée</p>
                        </div>
                        <div className="space-y-1 relative z-10 border-r border-pine-800/80 last:border-none">
                            <p className="text-4xl sm:text-5xl font-black text-emerald-400">15+</p>
                            <p className="text-xs text-sage-200 font-extrabold uppercase tracking-wider">Pays Livrés</p>
                        </div>
                        <div className="space-y-1 relative z-10">
                            <p className="text-4xl sm:text-5xl font-black text-emerald-400">4.9/5</p>
                            <p className="text-xs text-sage-200 font-extrabold uppercase tracking-wider">Note Moyenne Client</p>
                        </div>
                    </div>
                </section>

                {/* Section 3 : Valeurs Fondamentales */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10 relative z-10">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-extrabold text-pine-900 tracking-tight">Nos Valeurs Fondamentales</h2>
                        <p className="text-xs sm:text-sm text-gray-500 max-w-lg mx-auto">Ce qui guide chacun de nos choix au quotidien pour vous offrir l'expérience idéale.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-sage-200 shadow-sm space-y-4 hover:shadow-xl transition duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-sage-100 text-pine-900 flex items-center justify-center text-xl font-bold">
                                <i className="fa-solid fa-award"></i>
                            </div>
                            <h3 className="font-extrabold text-gray-900 text-base">Qualité Exigeante</h3>
                            <p className="text-xs text-gray-600 leading-relaxed font-medium">Chaque article est rigoureusement sélectionné et testé avant d'intégrer notre catalogue.</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-sage-200 shadow-sm space-y-4 hover:shadow-xl transition duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-sage-100 text-pine-900 flex items-center justify-center text-xl font-bold">
                                <i className="fa-solid fa-leaf"></i>
                            </div>
                            <h3 className="font-extrabold text-gray-900 text-base">Éco-Responsabilité</h3>
                            <p className="text-xs text-gray-600 leading-relaxed font-medium">Emballages recyclables et circuits d'approvisionnement visant à minimiser notre empreinte carbone.</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-sage-200 shadow-sm space-y-4 hover:shadow-xl transition duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-sage-100 text-pine-900 flex items-center justify-center text-xl font-bold">
                                <i className="fa-solid fa-eye"></i>
                            </div>
                            <h3 className="font-extrabold text-gray-900 text-base">Transparence Totale</h3>
                            <p className="text-xs text-gray-600 leading-relaxed font-medium">Prix justes toute l'année, pas de coûts cachés lors du passage en caisse.</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-sage-200 shadow-sm space-y-4 hover:shadow-xl transition duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-sage-100 text-pine-900 flex items-center justify-center text-xl font-bold">
                                <i className="fa-solid fa-heart"></i>
                            </div>
                            <h3 className="font-extrabold text-gray-900 text-base">Service Dévoué</h3>
                            <p className="text-xs text-gray-600 leading-relaxed font-medium">Une équipe de support réactive et attentive pour vous accompagner 7 jours sur 7.</p>
                        </div>
                    </div>
                </section>

                {/* Section 4 : L'Équipe VIVA */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 relative z-10">
                    <div className="text-center space-y-2 mb-10">
                        <h2 className="text-3xl font-extrabold text-pine-900 tracking-tight">Rencontrez Notre Équipe</h2>
                        <p className="text-xs sm:text-sm text-gray-500">Les passionnés qui façonnent l'univers VIVA chaque jour.</p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        <div className="bg-white p-6 rounded-3xl border border-sage-200 shadow-sm text-center space-y-3 hover:shadow-lg transition">
                            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" alt="Camille Laurent" className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-sage-100" />
                            <div>
                                <h4 className="font-extrabold text-pine-900 text-base">Camille Laurent</h4>
                                <p className="text-xs text-emerald-700 font-bold">Fondatrice & Directrice Artistique</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-sage-200 shadow-sm text-center space-y-3 hover:shadow-lg transition">
                            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80" alt="Alexandre Moreau" className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-sage-100" />
                            <div>
                                <h4 className="font-extrabold text-pine-900 text-base">Alexandre Moreau</h4>
                                <p className="text-xs text-emerald-700 font-bold">Chef Produit & Sourcing</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-sage-200 shadow-sm text-center space-y-3 hover:shadow-lg transition">
                            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80" alt="Sophie Valette" className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-sage-100" />
                            <div>
                                <h4 className="font-extrabold text-pine-900 text-base">Sophie Valette</h4>
                                <p className="text-xs text-emerald-700 font-bold">Responsable Expérience Client</p>
                            </div>
                        </div>
                    </div>
                </section>
                {extra && (
                    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10">
                        <div className="prose-viva bg-white p-8 rounded-3xl border border-sage-200 shadow-sm" dangerouslySetInnerHTML={{ __html: extra }} />
                    </section>
                )}
            </div>
    </>
  );
}
