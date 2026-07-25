---
layout: home

hero:
  name: vue-asset-map
  text: Карта инфраструктурных активов для Vue 3
  tagline: Сущности, связи и проекции одного графа — с поиском, фильтрами и трассировкой.
  actions:
    - theme: brand
      text: Начать
      link: /ru/guide/getting-started
    - theme: alt
      text: Примеры
      link: /ru/examples/
    - theme: alt
      text: GitHub
      link: https://github.com/LegionLiner/vue-asset-map

features:
  - title: Один граф, много проекций
    details: Сущности и связи объявляются один раз. Вид оставляет связи, у которых в layers есть его id, поэтому те же данные рисуются и как физическая топология, и как VPN-оверлей.
  - title: Карта, по которой кликают
    details: Поиск по имени, IPv4-маске и CIDR, фильтры по вашим фасетам, подробности в перетаскиваемых окнах, трассировка пути между двумя узлами.
  - title: Ничего не зашито
    details: Ни типов узлов, ни статусов, ни имён видов, ни строк интерфейса внутри пакета нет. Иконки, цвета, группы фильтров и локали приходят из ваших данных.
---

<LiveDemo :source="basicSource" source-label="Показать исходник" height="560px">
  <BasicMap />
</LiveDemo>

<script setup>
import basicSource from '../.vitepress/demos/BasicMap.vue?raw'
</script>
