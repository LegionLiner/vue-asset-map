---
layout: home

hero:
  name: vue-asset-map
  text: Карта инфраструктурных активов для Vue 3
  tagline: Компонент для сущностей, связей и представлений одного графа, с поиском, фильтрами и трассировкой пути.
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
  - title: Одни данные, несколько представлений
    details: Сущности и связи объявляются один раз. Представление оставляет связи, у которых в layers есть его id, поэтому те же данные рисуются и как физическая топология, и как VPN-оверлей.
  - title: Поиск, фильтры и трассировка
    details: Поиск по имени, IPv4-маске и CIDR, группы фильтров под ваши данные, подробности в перетаскиваемых окнах, трассировка пути между двумя узлами.
  - title: Типы, статусы и подписи — ваши
    details: Пакет не содержит типов узлов, статусов, имён представлений и строк интерфейса. Иконки, цвета, группы фильтров и локали приходят из ваших данных.
---

<LiveDemo :source="basicSource" source-label="Показать исходник" height="560px">
  <BasicMap />
</LiveDemo>

<script setup>
import basicSource from '../.vitepress/demos/BasicMap.vue?raw'
</script>
